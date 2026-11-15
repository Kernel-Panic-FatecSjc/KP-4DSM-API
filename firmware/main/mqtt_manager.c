#include <ctype.h>
#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#include "esp_event.h"
#include "esp_log.h"
#include "mqtt_client.h"
#include "cJSON.h"
#include "freertos/FreeRTOS.h"

#include "clock_sync.h"
#include "mqtt_manager.h"
#include "secrets.h"

static const char *TAG = "mqtt";
static esp_mqtt_client_handle_t s_client;
static char s_broker_uri[160];
static char s_client_id[96];
static char s_topic[160];
static bool s_connected;
static portMUX_TYPE s_connection_mux = portMUX_INITIALIZER_UNLOCKED;

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
    if (!clock_sync_get_unixtime(&unix_time)) {
        ESP_LOGW(TAG, "telemetria não publicada: relógio ainda não sincronizado");
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
        set_connected(true);
        ESP_LOGI(TAG, "conexão autenticada estabelecida");
        break;
    case MQTT_EVENT_DISCONNECTED:
        set_connected(false);
        ESP_LOGW(TAG, "conexão perdida; o cliente tentará reconectar");
        break;
    case MQTT_EVENT_ERROR:
        ESP_LOGE(TAG, "erro de conexão MQTT; o cliente tentará reconectar");
        break;
    case MQTT_EVENT_PUBLISHED: {
        const esp_mqtt_event_handle_t event = event_data;
        ESP_LOGI(TAG, "broker confirmou publicação QoS 1 (PUBACK), id=%d", event->msg_id);
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
    config.session.keepalive = 30;
    config.network.reconnect_timeout_ms = 5000;

    s_client = esp_mqtt_client_init(&config);
    if (s_client == NULL) {
        return ESP_ERR_NO_MEM;
    }

    ESP_LOGI(TAG, "conectando ao broker %s como estação %s", s_broker_uri, STATION_VID);
    esp_err_t error = esp_mqtt_client_register_event(
        s_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    if (error != ESP_OK) {
        return error;
    }

    return esp_mqtt_client_start(s_client);
}

esp_err_t mqtt_manager_publish_telemetry(const mqtt_telemetry_reading_t *readings,
                                         size_t reading_count,
                                         const double *latitude,
                                         const double *longitude)
{
    if (s_client == NULL || !is_connected()) {
        return ESP_ERR_INVALID_STATE;
    }

    char *payload = NULL;
    esp_err_t error = build_telemetry_payload(
        readings, reading_count, latitude, longitude, &payload);
    if (error != ESP_OK) {
        return error;
    }

    int message_id = esp_mqtt_client_publish(
        s_client, s_topic, payload, 0, 1, 0);
    cJSON_free(payload);
    if (message_id < 0) {
        ESP_LOGE(TAG, "falha ao publicar telemetria QoS 1");
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "telemetria enviada ao broker; aguardando confirmação QoS 1, id=%d",
             message_id);
    return ESP_OK;
}
