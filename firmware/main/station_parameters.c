#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cJSON.h"
#include "esp_http_client.h"
#include "esp_log.h"

#include "secrets.h"
#include "station_parameters.h"

#ifndef INGESTION_API_HOST
#define INGESTION_API_HOST MQTT_HOST
#endif
#ifndef INGESTION_API_PORT
#define INGESTION_API_PORT 3002
#endif

#define PARAMETER_RESPONSE_MAX_BYTES 8192

static const char *TAG = "station_parameters";

typedef struct {
    char body[PARAMETER_RESPONSE_MAX_BYTES + 1];
    size_t length;
    bool overflow;
} response_buffer_t;

static esp_err_t response_event_handler(esp_http_client_event_t *event)
{
    response_buffer_t *response = event->user_data;
    if (event->event_id != HTTP_EVENT_ON_DATA || event->data_len <= 0) {
        return ESP_OK;
    }
    if ((size_t)event->data_len > PARAMETER_RESPONSE_MAX_BYTES - response->length) {
        response->overflow = true;
        return ESP_ERR_INVALID_SIZE;
    }
    memcpy(response->body + response->length, event->data, (size_t)event->data_len);
    response->length += (size_t)event->data_len;
    response->body[response->length] = '\0';
    return ESP_OK;
}

static bool parameter_values(const cJSON *parameter, const char *expected_name,
                             double *factor, double *gain)
{
    const cJSON *name = cJSON_GetObjectItemCaseSensitive(parameter, "nome");
    const cJSON *factor_value = cJSON_GetObjectItemCaseSensitive(parameter, "fator");
    const cJSON *gain_value = cJSON_GetObjectItemCaseSensitive(parameter, "ganho");
    if (!cJSON_IsString(name) || strcmp(name->valuestring, expected_name) != 0 ||
        !cJSON_IsNumber(factor_value) || !cJSON_IsNumber(gain_value) ||
        !isfinite(factor_value->valuedouble) || factor_value->valuedouble == 0.0 ||
        !isfinite(gain_value->valuedouble)) {
        return false;
    }
    *factor = factor_value->valuedouble;
    *gain = gain_value->valuedouble;
    return true;
}

static bool apply_parameter(cJSON *parameters, const char *name,
                            double *factor, double *gain)
{
    if (name == NULL) return false;
    cJSON *parameter = NULL;
    cJSON_ArrayForEach(parameter, parameters) {
        if (parameter_values(parameter, name, factor, gain)) return true;
    }
    ESP_LOGW(TAG, "parâmetro '%s' não retornado pela estação; confirme o cadastro",
             name);
    return false;
}

esp_err_t station_parameters_apply(sensor_config_t *sensors, size_t sensor_count)
{
    if (sensors == NULL || sensor_count == 0) return ESP_ERR_INVALID_ARG;

    char url[256];
    int url_length = snprintf(url, sizeof(url),
                              "http://%s:%d/ingestao/estacoes/%s/parametros",
                              INGESTION_API_HOST, INGESTION_API_PORT, STATION_VID);
    if (url_length < 0 || (size_t)url_length >= sizeof(url)) return ESP_ERR_INVALID_SIZE;

    response_buffer_t *response = calloc(1, sizeof(*response));
    if (response == NULL) return ESP_ERR_NO_MEM;
    const esp_http_client_config_t config = {
        .url = url,
        .event_handler = response_event_handler,
        .user_data = response,
        .timeout_ms = 5000,
        .buffer_size = 1024,
        .buffer_size_tx = 512,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL) {
        free(response);
        return ESP_ERR_NO_MEM;
    }

    esp_err_t error = esp_http_client_set_method(client, HTTP_METHOD_GET);
    if (error == ESP_OK) {
        error = esp_http_client_set_header(client, "x-chave-estacao", STATION_KEY);
    }
    if (error == ESP_OK) error = esp_http_client_set_header(client, "Accept", "application/json");
    if (error == ESP_OK) error = esp_http_client_perform(client);
    int status = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);

    if (error != ESP_OK) {
        ESP_LOGW(TAG, "não foi possível consultar parâmetros da estação: %s",
                 esp_err_to_name(error));
        free(response);
        return error;
    }
    if (response->overflow) {
        free(response);
        return ESP_ERR_INVALID_SIZE;
    }
    if (status != 200) {
        ESP_LOGW(TAG, "consulta de parâmetros respondeu HTTP %d", status);
        free(response);
        return ESP_FAIL;
    }

    cJSON *root = cJSON_ParseWithLength(response->body, response->length);
    free(response);
    if (root == NULL) return ESP_ERR_INVALID_RESPONSE;
    const cJSON *vid = cJSON_GetObjectItemCaseSensitive(root, "vid");
    cJSON *parameters = cJSON_GetObjectItemCaseSensitive(root, "parametros");
    if (!cJSON_IsString(vid) || strcmp(vid->valuestring, STATION_VID) != 0 ||
        !cJSON_IsArray(parameters)) {
        cJSON_Delete(root);
        return ESP_ERR_INVALID_RESPONSE;
    }

    size_t applied = 0;
    for (size_t index = 0; index < sensor_count; index++) {
        sensor_config_t *sensor = &sensors[index];
        if (sensor->source == SENSOR_SOURCE_DHT11) {
            applied += apply_parameter(parameters,
                                       sensor->input.dht11.temperature_name,
                                       &sensor->input.dht11.temperature_factor,
                                       &sensor->input.dht11.temperature_gain);
            applied += apply_parameter(parameters,
                                       sensor->input.dht11.humidity_name,
                                       &sensor->input.dht11.humidity_factor,
                                       &sensor->input.dht11.humidity_gain);
        } else {
            applied += apply_parameter(parameters, sensor->name,
                                       &sensor->factor, &sensor->gain);
        }
    }

    ESP_LOGI(TAG, "%u configuração(ões) de aquisição associadas a parâmetros da estação",
             (unsigned)applied);
    cJSON_Delete(root);
    return ESP_OK;
}
