#include <dirent.h>
#include <errno.h>
#include <inttypes.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_log.h"
#include "esp_spiffs.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "nvs.h"
#include "nvs_flash.h"

#include "telemetry_queue.h"

#define QUEUE_PATH "/spiffs"
#define QUEUE_PARTITION "telemetry"
#define QUEUE_META_PARTITION "queue_meta"
#define QUEUE_META_NAMESPACE "queue"
#define QUEUE_META_READY_KEY "spiffs_ready"
#define QUEUE_ID_LENGTH 17
/* Capacidade da fila (SCRUM-34). 1.024 leituras a cada 5 min cobrem ~3,5 dias
 * sem rede; o ambiente esp32dev_teste_buffer usa 10 para testar fila cheia. */
#ifndef TELEMETRY_QUEUE_MAX_ITEMS
#define TELEMETRY_QUEUE_MAX_ITEMS 1024U
#endif
#if TELEMETRY_QUEUE_MAX_ITEMS < 1U || TELEMETRY_QUEUE_MAX_ITEMS > 4096U
#error "TELEMETRY_QUEUE_MAX_ITEMS deve ficar entre 1 e 4096"
#endif
#define QUEUE_MAX_ITEMS ((size_t)TELEMETRY_QUEUE_MAX_ITEMS)
#define QUEUE_MAX_PAYLOAD_BYTES (64U * 1024U)

static const char *TAG = "telemetry_queue";
static SemaphoreHandle_t s_mutex;
static bool s_started;

static bool valid_id(const char *name)
{
    if (name == NULL || strlen(name) != QUEUE_ID_LENGTH || name[0] != 'q') return false;
    for (size_t i = 1; i < QUEUE_ID_LENGTH; i++) {
        if (!((name[i] >= '0' && name[i] <= '9') ||
              (name[i] >= 'a' && name[i] <= 'f'))) return false;
    }
    return true;
}

static esp_err_t sequence_bounds(uint64_t *minimum, uint64_t *maximum, bool *found)
{
    DIR *directory = opendir(QUEUE_PATH);
    if (directory == NULL) return ESP_FAIL;
    struct dirent *entry;
    *found = false;
    while ((entry = readdir(directory)) != NULL) {
        if (!valid_id(entry->d_name)) continue;
        uint64_t value = strtoull(entry->d_name + 1, NULL, 16);
        if (!*found || value < *minimum) *minimum = value;
        if (!*found || value > *maximum) *maximum = value;
        *found = true;
    }
    closedir(directory);
    return ESP_OK;
}

static esp_err_t queue_item_count(size_t *count)
{
    DIR *directory = opendir(QUEUE_PATH);
    if (directory == NULL) return ESP_FAIL;
    *count = 0;
    struct dirent *entry;
    while ((entry = readdir(directory)) != NULL) {
        if (valid_id(entry->d_name)) (*count)++;
    }
    closedir(directory);
    return ESP_OK;
}

static esp_err_t get_filesystem_ready_marker(bool *ready)
{
    esp_err_t error = nvs_flash_init_partition(QUEUE_META_PARTITION);
    if (error != ESP_OK) return error;

    nvs_handle_t metadata;
    error = nvs_open_from_partition(QUEUE_META_PARTITION, QUEUE_META_NAMESPACE,
                                    NVS_READWRITE, &metadata);
    if (error != ESP_OK) return error;
    uint8_t value = 0;
    error = nvs_get_u8(metadata, QUEUE_META_READY_KEY, &value);
    nvs_close(metadata);
    if (error == ESP_ERR_NVS_NOT_FOUND) {
        *ready = false;
        return ESP_OK;
    }
    if (error != ESP_OK) return error;
    *ready = value == 1;
    return ESP_OK;
}

static esp_err_t set_filesystem_ready_marker(void)
{
    nvs_handle_t metadata;
    esp_err_t error = nvs_open_from_partition(QUEUE_META_PARTITION,
                                              QUEUE_META_NAMESPACE,
                                              NVS_READWRITE, &metadata);
    if (error != ESP_OK) return error;
    error = nvs_set_u8(metadata, QUEUE_META_READY_KEY, 1);
    if (error == ESP_OK) error = nvs_commit(metadata);
    nvs_close(metadata);
    return error;
}

esp_err_t telemetry_queue_start(void)
{
    if (s_started) return ESP_OK;

    bool filesystem_ready = false;
    esp_err_t error = get_filesystem_ready_marker(&filesystem_ready);
    if (error != ESP_OK) {
        ESP_LOGE(TAG, "falha ao ler marcador de inicialização sem apagar a fila: %s",
                 esp_err_to_name(error));
        return error;
    }

    const esp_vfs_spiffs_conf_t config = {
        .base_path = QUEUE_PATH,
        .partition_label = QUEUE_PARTITION,
        .max_files = 32,
        .format_if_mount_failed = !filesystem_ready,
    };
    error = esp_vfs_spiffs_register(&config);
    if (error != ESP_OK) {
        ESP_LOGE(TAG, "falha ao montar SPIFFS sem formatar dados existentes: %s",
                 esp_err_to_name(error));
        return error;
    }
    s_mutex = xSemaphoreCreateMutex();
    if (s_mutex == NULL) {
        esp_vfs_spiffs_unregister(QUEUE_PARTITION);
        return ESP_ERR_NO_MEM;
    }
    size_t total = 0, used = 0;
    error = esp_spiffs_info(QUEUE_PARTITION, &total, &used);
    if (error != ESP_OK) {
        vSemaphoreDelete(s_mutex);
        s_mutex = NULL;
        esp_vfs_spiffs_unregister(QUEUE_PARTITION);
        return error;
    }
    if (!filesystem_ready) {
        error = set_filesystem_ready_marker();
        if (error != ESP_OK) {
            vSemaphoreDelete(s_mutex);
            s_mutex = NULL;
            esp_vfs_spiffs_unregister(QUEUE_PARTITION);
            return error;
        }
    }
    size_t pending_items = 0;
    if (queue_item_count(&pending_items) != ESP_OK) pending_items = 0;
    ESP_LOGI(TAG, "fila persistente pronta: %u/%u itens pendentes, %u/%u bytes usados; "
                  "fila cheia descarta a leitura mais antiga",
             (unsigned)pending_items, (unsigned)QUEUE_MAX_ITEMS,
             (unsigned)used, (unsigned)total);
    s_started = true;
    return ESP_OK;
}

esp_err_t telemetry_queue_enqueue(const char *payload)
{
    if (!s_started || payload == NULL || payload[0] == '\0') return ESP_ERR_INVALID_ARG;
    size_t length = strlen(payload);
    if (length > QUEUE_MAX_PAYLOAD_BYTES) return ESP_ERR_INVALID_SIZE;

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    size_t item_count = 0;
    esp_err_t error = queue_item_count(&item_count);
    if (error != ESP_OK) {
        xSemaphoreGive(s_mutex);
        return error;
    }

    uint64_t minimum = 0, maximum = 0;
    bool found = false;
    /* Política de fila cheia (SCRUM-34): descarta a leitura mais antiga para
     * guardar a nova. Cada descarte é registrado no log com o id removido. */
    while (item_count >= QUEUE_MAX_ITEMS) {
        error = sequence_bounds(&minimum, &maximum, &found);
        if (error != ESP_OK || !found) {
            xSemaphoreGive(s_mutex);
            return error == ESP_OK ? ESP_FAIL : error;
        }
        char oldest[32];
        snprintf(oldest, sizeof(oldest), "%s/q%016" PRIx64, QUEUE_PATH, minimum);
        if (remove(oldest) != 0) {
            int saved_errno = errno;
            ESP_LOGE(TAG, "fila cheia e falha ao descartar o item mais antigo (errno=%d)",
                     saved_errno);
            xSemaphoreGive(s_mutex);
            return ESP_FAIL;
        }
        ESP_LOGW(TAG, "fila cheia (%u itens): leitura mais antiga descartada, id=q%016" PRIx64,
                 (unsigned)QUEUE_MAX_ITEMS, minimum);
        item_count--;
    }

    error = sequence_bounds(&minimum, &maximum, &found);
    if (error != ESP_OK || (found && maximum == UINT64_MAX)) {
        xSemaphoreGive(s_mutex);
        return error == ESP_OK ? ESP_ERR_INVALID_SIZE : error;
    }
    uint64_t sequence = found ? maximum + 1 : 1;
    char id[QUEUE_ID_LENGTH + 1], temp[32], path[32];
    snprintf(id, sizeof(id), "q%016" PRIx64, sequence);
    snprintf(temp, sizeof(temp), "%s/t%016" PRIx64, QUEUE_PATH, sequence);
    snprintf(path, sizeof(path), "%s/%s", QUEUE_PATH, id);

    FILE *file = fopen(temp, "wb");
    if (file == NULL) {
        ESP_LOGE(TAG, "sem espaço/arquivo para persistir telemetria (errno=%d)", errno);
        xSemaphoreGive(s_mutex);
        return ESP_FAIL;
    }
    bool written = fwrite(payload, 1, length, file) == length && fflush(file) == 0;
    bool closed = fclose(file) == 0;
    if (!written || !closed || rename(temp, path) != 0) {
        int saved_errno = errno;
        remove(temp);
        ESP_LOGE(TAG, "falha ao persistir item; itens anteriores preservados (errno=%d)",
                 saved_errno);
        xSemaphoreGive(s_mutex);
        return ESP_FAIL;
    }
    ESP_LOGI(TAG, "telemetria persistida: id=%s bytes=%u", id, (unsigned)length);
    xSemaphoreGive(s_mutex);
    return ESP_OK;
}

esp_err_t telemetry_queue_peek(char **payload, char *queue_id, size_t queue_id_size)
{
    if (!s_started || payload == NULL || queue_id == NULL ||
        queue_id_size < QUEUE_ID_LENGTH + 1) return ESP_ERR_INVALID_ARG;
    *payload = NULL;
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    uint64_t minimum = 0, maximum = 0;
    bool found = false;
    esp_err_t error = sequence_bounds(&minimum, &maximum, &found);
    if (error != ESP_OK || !found) {
        xSemaphoreGive(s_mutex);
        return error == ESP_OK ? ESP_ERR_NOT_FOUND : error;
    }
    snprintf(queue_id, queue_id_size, "q%016" PRIx64, minimum);
    char path[32];
    snprintf(path, sizeof(path), "%s/%s", QUEUE_PATH, queue_id);
    FILE *file = fopen(path, "rb");
    if (file == NULL || fseek(file, 0, SEEK_END) != 0) {
        if (file != NULL) fclose(file);
        xSemaphoreGive(s_mutex);
        return ESP_FAIL;
    }
    long length = ftell(file);
    if (length <= 0 || (unsigned long)length > QUEUE_MAX_PAYLOAD_BYTES ||
        fseek(file, 0, SEEK_SET) != 0) {
        fclose(file);
        xSemaphoreGive(s_mutex);
        return ESP_ERR_INVALID_SIZE;
    }
    char *buffer = malloc((size_t)length + 1);
    if (buffer == NULL) {
        fclose(file);
        xSemaphoreGive(s_mutex);
        return ESP_ERR_NO_MEM;
    }
    size_t bytes = fread(buffer, 1, (size_t)length, file);
    fclose(file);
    if (bytes != (size_t)length) {
        free(buffer);
        xSemaphoreGive(s_mutex);
        return ESP_FAIL;
    }
    buffer[length] = '\0';
    *payload = buffer;
    xSemaphoreGive(s_mutex);
    return ESP_OK;
}

esp_err_t telemetry_queue_remove(const char *queue_id)
{
    if (!s_started || !valid_id(queue_id)) return ESP_ERR_INVALID_ARG;
    char path[32];
    snprintf(path, sizeof(path), "%s/%s", QUEUE_PATH, queue_id);
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    int result = remove(path);
    int saved_errno = errno;
    xSemaphoreGive(s_mutex);
    if (result != 0 && saved_errno == ENOENT) {
        /* O item foi descartado por fila cheia enquanto aguardava o PUBACK. */
        ESP_LOGW(TAG, "PUBACK de item já descartado da fila: id=%s", queue_id);
        return ESP_OK;
    }
    if (result != 0) {
        ESP_LOGE(TAG, "falha ao remover item confirmado (errno=%d)", saved_errno);
        return ESP_FAIL;
    }
    ESP_LOGI(TAG, "PUBACK recebido; item removido da fila: id=%s", queue_id);
    return ESP_OK;
}
