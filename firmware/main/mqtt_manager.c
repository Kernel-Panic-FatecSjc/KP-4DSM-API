#include <ctype.h>
#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_event.h"
#include "esp_log.h"
#include "mqtt_client.h"
#include "cJSON.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "clock_sync.h"
#include "mqtt_manager.h"
#include "telemetry_queue.h"

#define QUEUE_RETRY_INITIAL_MS 1000U
#define QUEUE_RETRY_MAX_MS 60000U
/* Sem PUBACK nesse prazo, a publicação é considerada perdida: o cliente é
 * reiniciado e o item, que continua na fila SPIFFS, é publicado de novo. */
#define PUBACK_TIMEOUT_MS 20000U
/* Tentativa de conexão sem CONNECTED/DISCONNECTED nesse prazo é abandonada. */
#define CONNECT_ATTEMPT_TIMEOUT_MS 30000U
/* Enquanto há publicação ou conexão pendente, o worker acorda nesse período
 * para conferir os prazos acima. */
#define WORKER_WATCHDOG_PERIOD_MS 5000U
#include "secrets.h"

static const char *TAG = "mqtt";
static esp_mqtt_client_handle_t s_client;
static char s_broker_uri[160];
static char s_client_id[96];
static char s_topic[160];
static bool s_connected;
static bool s_connecting;
static portMUX_TYPE s_connection_mux = portMUX_INITIALIZER_UNLOCKED;
static int s_inflight_message_id = -1;
static bool s_sending_queue_item;
static char s_inflight_queue_id[18];
static int s_early_ack_message_id = -1;
static TaskHandle_t s_retry_task;
static bool s_client_started;
static uint32_t s_retry_delay_ms = QUEUE_RETRY_INITIAL_MS;
static portMUX_TYPE s_queue_mux = portMUX_INITIALIZER_UNLOCKED;
/* Incrementado a cada perda/reinício da conexão. Uma publicação iniciada em
 * uma geração não pode virar "em voo" em outra: o PUBACK dela nunca chegará. */
static uint32_t s_connection_generation;
static TickType_t s_inflight_since;
static TickType_t s_connecting_since;
static uint32_t s_stat_connects;
static uint32_t s_stat_disconnects;
static uint32_t s_stat_pubacks;
static uint32_t s_stat_inflight_resets;

static void publish_next_queued_telemetry(void);
static void set_connected(bool connected);
static bool is_connected(void);
static bool is_connecting(void);
static void set_connecting(bool connecting);
static void notify_queue_worker_now(void);

/* Exige s_queue_mux tomado. */
static void clear_inflight_locked(void)
{
    s_inflight_message_id = -1;
    s_inflight_queue_id[0] = '\0';
    s_early_ack_message_id = -1;
}

/* Esquece a publicação em voo. O item não é removido da fila SPIFFS: será
 * publicado de novo na próxima conexão (possível duplicata, tratada pelo
 * tratamento via parametroId + unixtime). Necessário porque
 * esp_mqtt_client_stop() apaga o outbox do ESP-MQTT e, com reconexão
 * automática desligada, o PUBACK da publicação antiga nunca chega. */
static void forget_inflight(const char *reason)
{
    bool had_inflight;
    portENTER_CRITICAL(&s_queue_mux);
    had_inflight = s_inflight_message_id >= 0 || s_inflight_queue_id[0] != '\0';
    clear_inflight_locked();
    s_connection_generation++;
    if (had_inflight) s_stat_inflight_resets++;
    portEXIT_CRITICAL(&s_queue_mux);
    if (had_inflight) {
        ESP_LOGW(TAG, "publicação sem PUBACK abandonada (%s); item segue na fila e será reenviado",
                 reason);
    }
}

static bool inflight_expired(void)
{
    bool expired;
    const TickType_t now = xTaskGetTickCount();
    portENTER_CRITICAL(&s_queue_mux);
    expired = s_inflight_message_id >= 0 &&
              (now - s_inflight_since) >= pdMS_TO_TICKS(PUBACK_TIMEOUT_MS);
    portEXIT_CRITICAL(&s_queue_mux);
    return expired;
}

static bool has_inflight(void)
{
    bool inflight;
    portENTER_CRITICAL(&s_queue_mux);
    inflight = s_inflight_message_id >= 0;
    portEXIT_CRITICAL(&s_queue_mux);
    return inflight;
}

static void log_connection_stats(void)
{
    uint32_t connects, disconnects, pubacks, resets;
    portENTER_CRITICAL(&s_queue_mux);
    connects = s_stat_connects;
    disconnects = s_stat_disconnects;
    pubacks = s_stat_pubacks;
    resets = s_stat_inflight_resets;
    portEXIT_CRITICAL(&s_queue_mux);
    ESP_LOGI(TAG, "estatísticas MQTT: conexões=%u desconexões=%u pubacks=%u reenvios_sem_puback=%u",
             (unsigned)connects, (unsigned)disconnects, (unsigned)pubacks, (unsigned)resets);
}

static esp_err_t queue_has_pending(bool *pending)
{
    if (pending == NULL) return ESP_ERR_INVALID_ARG;

    char *payload = NULL;
    char queue_id[18] = {0};
    esp_err_t error = telemetry_queue_peek(&payload, queue_id, sizeof(queue_id));
    if (error == ESP_ERR_NOT_FOUND) {
        *pending = false;
        return ESP_OK;
    }
    if (error != ESP_OK) return error;

    free(payload);
    *pending = true;
    return ESP_OK;
}

static void schedule_queue_retry(void)
{
    if (s_retry_task == NULL) return;
    portENTER_CRITICAL(&s_queue_mux);
    uint32_t delay_ms = s_retry_delay_ms;
    if (s_retry_delay_ms < QUEUE_RETRY_MAX_MS) {
        s_retry_delay_ms = (s_retry_delay_ms > QUEUE_RETRY_MAX_MS / 2U)
                               ? QUEUE_RETRY_MAX_MS
                               : s_retry_delay_ms * 2U;
    }
    portEXIT_CRITICAL(&s_queue_mux);
    xTaskNotify(s_retry_task, delay_ms, eSetValueWithOverwrite);
}

static void notify_queue_worker_now(void)
{
    if (s_retry_task != NULL) {
        xTaskNotify(s_retry_task, 0, eSetValueWithOverwrite);
    }
}

static esp_err_t start_or_reconnect_client(void)
{
    esp_err_t error;
    /* stop() envia DISCONNECT (se conectado), fecha o socket e apaga o
     * outbox; qualquer publicação em voo precisa ser reenviada da fila. */
    set_connected(false);
    forget_inflight("cliente MQTT reiniciado");
    if (s_client_started) {
        /* A previous batch may have ended either by an explicit stop or a
         * transport failure. Stop the old MQTT task before creating a fresh
         * connection attempt instead of reusing a stale reconnect state. */
        error = esp_mqtt_client_stop(s_client);
        if (error != ESP_OK) {
            return error;
        }
        s_client_started = false;
    }

    error = esp_mqtt_client_start(s_client);
    if (error == ESP_OK) s_client_started = true;
    return error;
}

static void queue_retry_task(void *argument)
{
    (void)argument;
    for (;;) {
        uint32_t delay_ms = 0;
        const TickType_t wait_ticks = (has_inflight() || is_connecting())
                                          ? pdMS_TO_TICKS(WORKER_WATCHDOG_PERIOD_MS)
                                          : portMAX_DELAY;
        const bool notified = xTaskNotifyWait(0, UINT32_MAX, &delay_ms, wait_ticks) == pdTRUE;
        if (notified && delay_ms > 0) vTaskDelay(pdMS_TO_TICKS(delay_ms));

        if (is_connected() && inflight_expired()) {
            ESP_LOGW(TAG, "PUBACK não recebido em %u ms; reiniciando conexão",
                     (unsigned)PUBACK_TIMEOUT_MS);
            set_connecting(true);
            esp_err_t restart_error = start_or_reconnect_client();
            if (restart_error != ESP_OK) {
                set_connecting(false);
                ESP_LOGW(TAG, "não foi possível reiniciar MQTT: %s",
                         esp_err_to_name(restart_error));
                schedule_queue_retry();
            }
            continue;
        }

        if (is_connecting()) {
            TickType_t since;
            portENTER_CRITICAL(&s_connection_mux);
            since = s_connecting_since;
            portEXIT_CRITICAL(&s_connection_mux);
            if ((xTaskGetTickCount() - since) >= pdMS_TO_TICKS(CONNECT_ATTEMPT_TIMEOUT_MS)) {
                ESP_LOGW(TAG, "tentativa de conexão sem resposta em %u ms; nova tentativa",
                         (unsigned)CONNECT_ATTEMPT_TIMEOUT_MS);
                set_connecting(false);
            }
        }

        {
            bool pending = false;
            esp_err_t error = queue_has_pending(&pending);
            if (error != ESP_OK) {
                ESP_LOGE(TAG, "falha ao consultar fila persistente: %s",
                         esp_err_to_name(error));
                schedule_queue_retry();
                continue;
            }

            if (!pending) {
                if (s_client_started) {
                    ESP_LOGI(TAG, "fila vazia; parando cliente MQTT até a próxima leitura");
                    /* stop() envia DISCONNECT ao broker e fecha o socket. */
                    error = esp_mqtt_client_stop(s_client);
                    if (error != ESP_OK) {
                        ESP_LOGW(TAG, "falha ao parar cliente MQTT ocioso: %s",
                                 esp_err_to_name(error));
                    } else {
                        s_client_started = false;
                        set_connected(false);
                        set_connecting(false);
                        forget_inflight("cliente MQTT parado");
                        ESP_LOGI(TAG, "cliente MQTT parado: DISCONNECT enviado (se conectado) e socket fechado");
                        log_connection_stats();
                    }
                }
                continue;
            }

            if (is_connected()) {
                publish_next_queued_telemetry();
                continue;
            }

            /* Notifications can arrive from both the queue and MQTT events.
             * Do not ask ESP-MQTT to reconnect while its prior attempt is
             * still in progress. */
            if (is_connecting()) {
                continue;
            }

            ESP_LOGI(TAG, "abrindo conexão MQTT para enviar telemetria pendente");
            set_connecting(true);
            error = start_or_reconnect_client();
            if (error != ESP_OK) {
                set_connecting(false);
                ESP_LOGW(TAG, "não foi possível iniciar/reconectar MQTT: %s",
                         esp_err_to_name(error));
                schedule_queue_retry();
            }
        }
    }
}

static void set_connected(bool connected)
{
    portENTER_CRITICAL(&s_connection_mux);
    s_connected = connected;
    portEXIT_CRITICAL(&s_connection_mux);
}

static bool is_connected(void)
{
    bool connected;
    portENTER_CRITICAL(&s_connection_mux);
    connected = s_connected;
    portEXIT_CRITICAL(&s_connection_mux);
    return connected;
}

static void set_connecting(bool connecting)
{
    const TickType_t now = xTaskGetTickCount();
    portENTER_CRITICAL(&s_connection_mux);
    s_connecting = connecting;
    if (connecting) s_connecting_since = now;
    portEXIT_CRITICAL(&s_connection_mux);
}

static bool is_connecting(void)
{
    bool connecting;
    portENTER_CRITICAL(&s_connection_mux);
    connecting = s_connecting;
    portEXIT_CRITICAL(&s_connection_mux);
    return connecting;
}

static bool reading_name_is_valid(const char *name)
{
    if (name == NULL) {
        return false;
    }

    size_t length = strlen(name);
    if (length == 0 || length > 120 ||
        isspace((unsigned char)name[0]) ||
        isspace((unsigned char)name[length - 1])) {
        return false;
    }

    for (size_t index = 0; index < length; index++) {
        unsigned char character = (unsigned char)name[index];
        if (character < 0x20 || character == 0x7f) {
            return false;
        }
    }
    return true;
}

static esp_err_t build_telemetry_payload(const mqtt_telemetry_reading_t *readings,
                                         size_t reading_count,
                                         const double *latitude,
                                         const double *longitude,
                                         char **payload)
{
    if (readings == NULL || payload == NULL ||
        reading_count == 0 || reading_count > MQTT_TELEMETRY_MAX_READINGS ||
        ((latitude == NULL) != (longitude == NULL))) {
        return ESP_ERR_INVALID_ARG;
    }
    if (latitude != NULL &&
        (!isfinite(*latitude) || !isfinite(*longitude) ||
         *latitude < -90.0 || *latitude > 90.0 ||
         *longitude < -180.0 || *longitude > 180.0)) {
        return ESP_ERR_INVALID_ARG;
    }

    int64_t unix_time;
    bool has_valid_time = clock_sync_get_unixtime(&unix_time);
    if (!has_valid_time) {
        /* Não enfileira leitura sem horário: o reenvio receberia o horário
         * de chegada, e a deduplicação por unixtime deixaria de funcionar. */
        ESP_LOGW(TAG, "relógio não sincronizado; leitura descartada sem gerar pacote");
        return ESP_ERR_INVALID_STATE;
    }

    cJSON *root = cJSON_CreateObject();
    cJSON *sensor_readings = cJSON_CreateObject();
    if (root == NULL || sensor_readings == NULL) {
        cJSON_Delete(root);
        cJSON_Delete(sensor_readings);
        return ESP_ERR_NO_MEM;
    }

    esp_err_t error = ESP_OK;
    if (cJSON_AddNumberToObject(root, "unixtime", (double)unix_time) == NULL ||
        (latitude != NULL &&
         (cJSON_AddNumberToObject(root, "latitude", *latitude) == NULL ||
          cJSON_AddNumberToObject(root, "longitude", *longitude) == NULL))) {
        error = ESP_ERR_NO_MEM;
    }

    for (size_t index = 0; error == ESP_OK && index < reading_count; index++) {
        if (!reading_name_is_valid(readings[index].name) || !isfinite(readings[index].value)) {
            error = ESP_ERR_INVALID_ARG;
            break;
        }
        for (size_t previous = 0; previous < index; previous++) {
            if (strcmp(readings[index].name, readings[previous].name) == 0) {
                error = ESP_ERR_INVALID_ARG;
                break;
            }
        }
        if (error == ESP_OK &&
            cJSON_AddNumberToObject(sensor_readings, readings[index].name,
                                    readings[index].value) == NULL) {
            error = ESP_ERR_NO_MEM;
        }
    }

    if (error == ESP_OK && !cJSON_AddItemToObject(root, "leituras", sensor_readings)) {
        error = ESP_ERR_NO_MEM;
    } else if (error == ESP_OK) {
        sensor_readings = NULL;
    }

    if (error == ESP_OK) {
        *payload = cJSON_PrintUnformatted(root);
        if (*payload == NULL) {
            error = ESP_ERR_NO_MEM;
        }
    }

    cJSON_Delete(sensor_readings);
    cJSON_Delete(root);
    return error;
}

static void mqtt_event_handler(void *handler_argument,
                               esp_event_base_t event_base,
                               int32_t event_id,
                               void *event_data)
{
    (void)handler_argument;
    (void)event_base;
    (void)event_data;

    switch (event_id) {
    case MQTT_EVENT_CONNECTED:
        /* Sessão nova (outbox vazio após stop/start): nada antigo está em voo. */
        forget_inflight("nova conexão");
        set_connecting(false);
        set_connected(true);
        portENTER_CRITICAL(&s_queue_mux);
        s_retry_delay_ms = QUEUE_RETRY_INITIAL_MS;
        s_stat_connects++;
        portEXIT_CRITICAL(&s_queue_mux);
        ESP_LOGI(TAG, "conexão autenticada estabelecida");
        log_connection_stats();
        notify_queue_worker_now();
        break;
    case MQTT_EVENT_DISCONNECTED:
        set_connected(false);
        set_connecting(false);
        portENTER_CRITICAL(&s_queue_mux);
        s_stat_disconnects++;
        portEXIT_CRITICAL(&s_queue_mux);
        forget_inflight("conexão encerrada antes do PUBACK");
        ESP_LOGW(TAG, "conexão MQTT encerrada; itens sem PUBACK permanecem na fila");
        log_connection_stats();
        schedule_queue_retry();
        break;
    case MQTT_EVENT_ERROR:
        ESP_LOGE(TAG, "erro de conexão MQTT");
        /* MQTT_EVENT_DISCONNECTED schedules the retry for this failed
         * connection. Scheduling here as well doubles the backoff twice. */
        break;
    case MQTT_EVENT_PUBLISHED: {
        const esp_mqtt_event_handle_t event = event_data;
        ESP_LOGI(TAG, "broker confirmou publicação QoS 1 (PUBACK), id=%d", event->msg_id);
        char queue_id[sizeof(s_inflight_queue_id)] = {0};
        bool acknowledged = false;
        portENTER_CRITICAL(&s_queue_mux);
        if (s_inflight_message_id == event->msg_id && s_inflight_queue_id[0] != '\0') {
            memcpy(queue_id, s_inflight_queue_id, sizeof(queue_id));
            s_inflight_message_id = -1;
            s_inflight_queue_id[0] = '\0';
            s_stat_pubacks++;
            acknowledged = true;
        } else if (s_sending_queue_item && s_inflight_queue_id[0] != '\0') {
            s_early_ack_message_id = event->msg_id;
        }
        portEXIT_CRITICAL(&s_queue_mux);
        if (acknowledged) {
            portENTER_CRITICAL(&s_queue_mux);
            s_retry_delay_ms = QUEUE_RETRY_INITIAL_MS;
            portEXIT_CRITICAL(&s_queue_mux);
            if (telemetry_queue_remove(queue_id) != ESP_OK) {
                ESP_LOGE(TAG, "PUBACK recebido, mas não foi possível remover item persistido");
                schedule_queue_retry();
            } else {
                notify_queue_worker_now();
            }
        }
        break;
    }
    default:
        break;
    }
}

esp_err_t mqtt_manager_start(void)
{
    int uri_length = snprintf(s_broker_uri, sizeof(s_broker_uri),
                              "mqtt://%s:%d", MQTT_HOST, MQTT_PORT);
    int client_id_length = snprintf(s_client_id, sizeof(s_client_id),
                                    "datalogger-%s", STATION_VID);
    int topic_length = snprintf(s_topic, sizeof(s_topic),
                                "estacoes/%s/telemetria", STATION_VID);
    if (uri_length < 0 || (size_t)uri_length >= sizeof(s_broker_uri) ||
        client_id_length < 0 || (size_t)client_id_length >= sizeof(s_client_id) ||
        topic_length < 0 || (size_t)topic_length >= sizeof(s_topic)) {
        return ESP_ERR_INVALID_SIZE;
    }

    esp_mqtt_client_config_t config = {0};
    config.broker.address.uri = s_broker_uri;
    config.credentials.username = STATION_VID;
    config.credentials.client_id = s_client_id;
    config.credentials.authentication.password = STATION_KEY;
    config.session.keepalive = 15;
    config.network.disable_auto_reconnect = true;
    config.network.timeout_ms = 5000;
    config.network.reconnect_timeout_ms = 5000;

    s_client = esp_mqtt_client_init(&config);
    if (s_client == NULL) {
        return ESP_ERR_NO_MEM;
    }

    ESP_LOGI(TAG, "MQTT preparado para envio sob demanda em %s como estação %s",
             s_broker_uri, STATION_VID);
    esp_err_t error = esp_mqtt_client_register_event(
        s_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    if (error != ESP_OK) {
        return error;
    }

    if (xTaskCreate(queue_retry_task, "mqtt_queue_retry", 3072, NULL, 5,
                    &s_retry_task) != pdPASS) {
        return ESP_ERR_NO_MEM;
    }

    bool pending = false;
    error = queue_has_pending(&pending);
    if (error != ESP_OK) return error;
    if (pending) notify_queue_worker_now();
    return ESP_OK;
}

esp_err_t mqtt_manager_publish_telemetry(const mqtt_telemetry_reading_t *readings,
                                         size_t reading_count,
                                         const double *latitude,
                                         const double *longitude)
{
    if (s_client == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    char *payload = NULL;
    esp_err_t error = build_telemetry_payload(
        readings, reading_count, latitude, longitude, &payload);
    if (error != ESP_OK) {
        return error;
    }

    error = telemetry_queue_enqueue(payload);
    cJSON_free(payload);
    if (error != ESP_OK) {
        ESP_LOGE(TAG, "telemetria não coube na fila persistente: %s", esp_err_to_name(error));
        return error;
    }

    notify_queue_worker_now();
    return ESP_OK;
}

static void publish_next_queued_telemetry(void)
{
    if (s_client == NULL || !is_connected()) return;

    portENTER_CRITICAL(&s_queue_mux);
    if (s_sending_queue_item || s_inflight_message_id >= 0) {
        portEXIT_CRITICAL(&s_queue_mux);
        return;
    }
    s_sending_queue_item = true;
    const uint32_t generation = s_connection_generation;
    portEXIT_CRITICAL(&s_queue_mux);

    char *payload = NULL;
    char queue_id[sizeof(s_inflight_queue_id)] = {0};
    esp_err_t error = telemetry_queue_peek(&payload, queue_id, sizeof(queue_id));
    if (error == ESP_ERR_NOT_FOUND) {
        portENTER_CRITICAL(&s_queue_mux);
        s_sending_queue_item = false;
        portEXIT_CRITICAL(&s_queue_mux);
        notify_queue_worker_now();
        return;
    }
    if (error != ESP_OK) {
        ESP_LOGE(TAG, "falha ao ler fila persistente: %s", esp_err_to_name(error));
        portENTER_CRITICAL(&s_queue_mux);
        s_sending_queue_item = false;
        portEXIT_CRITICAL(&s_queue_mux);
        return;
    }

    portENTER_CRITICAL(&s_queue_mux);
    memcpy(s_inflight_queue_id, queue_id, sizeof(s_inflight_queue_id));
    s_early_ack_message_id = -1;
    portEXIT_CRITICAL(&s_queue_mux);
    int message_id = esp_mqtt_client_publish(s_client, s_topic, payload, 0, 1, 0);
    free(payload);

    bool acknowledged_early = false;
    bool connection_lost = false;
    const TickType_t published_at = xTaskGetTickCount();
    portENTER_CRITICAL(&s_queue_mux);
    s_sending_queue_item = false;
    if (generation != s_connection_generation) {
        /* A conexão caiu ou foi reiniciada durante o publish: o PUBACK dele
         * não virá. O item continua na fila para a próxima conexão. */
        clear_inflight_locked();
        connection_lost = true;
    } else if (message_id >= 0) {
        if (s_early_ack_message_id == message_id) {
            s_early_ack_message_id = -1;
            s_inflight_queue_id[0] = '\0';
            s_stat_pubacks++;
            acknowledged_early = true;
        } else {
            s_inflight_message_id = message_id;
            s_inflight_since = published_at;
        }
    } else {
        s_inflight_queue_id[0] = '\0';
    }
    portEXIT_CRITICAL(&s_queue_mux);

    if (connection_lost) {
        /* MQTT_EVENT_DISCONNECTED já agendou a nova tentativa. */
        ESP_LOGW(TAG, "conexão perdida durante a publicação; item permanece na fila");
    } else if (message_id < 0) {
        ESP_LOGW(TAG, "falha ao publicar; item permanece na fila para nova tentativa");
        schedule_queue_retry();
    } else if (acknowledged_early) {
        portENTER_CRITICAL(&s_queue_mux);
        s_retry_delay_ms = QUEUE_RETRY_INITIAL_MS;
        portEXIT_CRITICAL(&s_queue_mux);
        if (telemetry_queue_remove(queue_id) != ESP_OK) {
            ESP_LOGE(TAG, "PUBACK recebido, mas não foi possível remover item persistido");
            schedule_queue_retry();
        } else {
            notify_queue_worker_now();
        }
    } else {
        ESP_LOGI(TAG, "publicação MQTT QoS 1 iniciada; aguardando PUBACK id=%d", message_id);
    }
}
