#include <stdbool.h>
#include <string.h>

#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"

#include "clock_sync.h"
#include "mqtt_manager.h"
#include "secrets.h"
#include "sensor_manager.h"
#include "station_parameters.h"
#include "telemetry_queue.h"
#include "wifi_manager.h"

static const char *TAG = "data_logger";

/* Intervalo temporário para teste/apresentação; use 300000U na operação nominal. */
#define APP_SENSOR_SAMPLE_INTERVAL_MS 30000U

/* Names and identity conversions chosen from each sensor's native output.
 * Register these exact parameter names on the station before treating data. */
static sensor_config_t s_test_sensors[] = {
    {
        .name = "dht22",
        .source = SENSOR_SOURCE_DHT22,
        .factor = 1.0,
        .gain = 0.0,
        .input.dht22 = {
            .pin = GPIO_NUM_14,
            .temperature_name = "temperatura_c",
            .temperature_factor = 1.0,
            .temperature_gain = 0.0,
            .humidity_name = "umidade_pct",
            .humidity_factor = 1.0,
            .humidity_gain = 0.0,
        },
    },
    {
        .name = "luminosidade_adc",
        .source = SENSOR_SOURCE_ADC1,
        .factor = 1.0,
        .gain = 0.0,
        .input.adc = {
            .channel = ADC_CHANNEL_4, /* GPIO32 / ADC1_CH4 */
            .raw_min = 0,
            .raw_max = 4095,
        },
    },
};

static void publish_sensor_readings(const mqtt_telemetry_reading_t *readings,
                                    size_t reading_count,
                                    void *context)
{
    (void)context;
    for (size_t index = 0; index < reading_count; index++) {
        ESP_LOGI(TAG, "leitura coletada: %s=%.3f",
                 readings[index].name, readings[index].value);
    }
    esp_err_t error = mqtt_manager_publish_telemetry(
        readings, reading_count, NULL, NULL);
    if (error != ESP_OK) {
        ESP_LOGW(TAG, "telemetria não publicada: %s", esp_err_to_name(error));
    }
}

static bool value_is_configured(const char *value)
{
    return value != NULL && value[0] != '\0' && strcmp(value, "CHANGE_ME") != 0;
}

static esp_err_t initialize_nvs(void)
{
    esp_err_t error = nvs_flash_init();
    if (error == ESP_ERR_NVS_NO_FREE_PAGES || error == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        error = nvs_flash_init();
    }
    return error;
}

void app_main(void)
{
    ESP_LOGI(TAG, "inicializando firmware do Data Logger");

    if (!value_is_configured(WIFI_SSID) || !value_is_configured(WIFI_PASSWORD) ||
        !value_is_configured(STATION_VID) || !value_is_configured(STATION_KEY) ||
        !value_is_configured(MQTT_HOST) || MQTT_PORT <= 0) {
        ESP_LOGE(TAG, "configuração ausente; preencha o arquivo local include/secrets.h");
        return;
    }

    ESP_ERROR_CHECK(initialize_nvs());
    ESP_ERROR_CHECK(telemetry_queue_start());
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    ESP_ERROR_CHECK(wifi_manager_start());

    ESP_LOGI(TAG, "aguardando conexão Wi-Fi");
    if (!wifi_manager_wait_connected(portMAX_DELAY)) {
        ESP_LOGE(TAG, "não foi possível conectar ao Wi-Fi");
        return;
    }

    esp_err_t parameter_error = station_parameters_apply(
        s_test_sensors, sizeof(s_test_sensors) / sizeof(s_test_sensors[0]));
    if (parameter_error != ESP_OK) {
        ESP_LOGW(TAG, "usando conversões locais; consulta de parâmetros falhou: %s",
                 esp_err_to_name(parameter_error));
    }

    ESP_ERROR_CHECK(clock_sync_start());
    if (!clock_sync_wait(pdMS_TO_TICKS(15000))) {
        ESP_LOGW(TAG, "NTP ainda não sincronizou; o serviço continuará tentando");
    }

    ESP_ERROR_CHECK(mqtt_manager_start());
    ESP_ERROR_CHECK(sensor_manager_start(
        s_test_sensors, sizeof(s_test_sensors) / sizeof(s_test_sensors[0]),
        APP_SENSOR_SAMPLE_INTERVAL_MS,
        publish_sensor_readings, NULL));
}
