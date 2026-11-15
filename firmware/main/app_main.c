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
#include "wifi_manager.h"

static const char *TAG = "data_logger";

static void publish_sensor_readings(const mqtt_telemetry_reading_t *readings,
                                    size_t reading_count,
                                    void *context)
{
    (void)context;
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
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    ESP_ERROR_CHECK(wifi_manager_start());

    ESP_LOGI(TAG, "aguardando conexão Wi-Fi");
    if (!wifi_manager_wait_connected(portMAX_DELAY)) {
        ESP_LOGE(TAG, "não foi possível conectar ao Wi-Fi");
        return;
    }

    ESP_ERROR_CHECK(clock_sync_start());
    if (!clock_sync_wait(pdMS_TO_TICKS(15000))) {
        ESP_LOGW(TAG, "NTP ainda não sincronizou; o serviço continuará tentando");
    }

    ESP_ERROR_CHECK(mqtt_manager_start());
    ESP_ERROR_CHECK(sensor_manager_start(
        NULL, 0, SENSOR_MANAGER_SAMPLE_INTERVAL_DEFAULT_MS,
        publish_sensor_readings, NULL));
}
