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

static void publish_next_queued_telemetry(void);
static void set_connected(bool connected);
static bool is_connected(void);
static bool is_connecting(void);
static void set_connecting(bool connecting);
static void notify_queue_worker_now(void);

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
        if (xTaskNotifyWait(0, UINT32_MAX, &delay_ms, portMAX_DELAY) == pdTRUE) {
            if (delay_ms > 0) vTaskDelay(pdMS_TO_TICKS(delay_ms));

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
                    error = esp_mqtt_client_stop(s_client);
                    if (error != ESP_OK) {
                        ESP_LOGW(TAG, "falha ao parar cliente MQTT ocioso: %s",
                                 esp_err_to_name(error));
                    } else {
                        s_client_started = false;
                        set_connected(false);
                        set_connecting(false);
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
    portENTER_CRITICAL(&s_connection_mux);
    s_connecting = connecting;
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
        ESP_LOGW(TAG, "relógio ainda não sincronizado; ingestão aplicará o horário de recebimento");
    }

    cJSON *root = cJSON_CreateObject();
    cJSON *sensor_readings = cJSON_CreateObject();
    if (root == NULL || sensor_readings == NULL) {
        cJSON_Delete(root);
        cJSON_Delete(sensor_readings);
        return ESP_ERR_NO_MEM;
    }

    esp_err_t error = ESP_OK;
    if ((has_valid_time &&
         cJSON_AddNumberToObject(root, "unixtime", (double)unix_time) == NULL) ||
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
        set_connecting(false);
        set_connected(true);
        portENTER_CRITICAL(&s_queue_mux);
        s_retry_delay_ms = QUEUE_RETRY_INITIAL_MS;
        portEXIT_CRITICAL(&s_queue_mux);
        ESP_LOGI(TAG, "conexão autenticada estabelecida");
        notify_queue_worker_now();
        break;
    case MQTT_EVENT_DISCONNECTED:
        set_connected(false);
        set_connecting(false);
        ESP_LOGW(TAG, "conexão MQTT encerrada; itens sem PUBACK permanecem na fila");
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
    portENTER_CRITICAL(&s_queue_mux);
    s_sending_queue_item = false;
    if (message_id >= 0) {
        if (s_early_ack_message_id == message_id) {
            s_early_ack_message_id = -1;
            s_inflight_queue_id[0] = '\0';
            acknowledged_early = true;
        } else {
            s_inflight_message_id = message_id;
        }
    } else {
        s_inflight_queue_id[0] = '\0';
    }
    portEXIT_CRITICAL(&s_queue_mux);

    if (message_id < 0) {
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
