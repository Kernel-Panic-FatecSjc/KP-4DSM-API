#include <inttypes.h>
#include <stdbool.h>
#include <time.h>

#include "esp_log.h"
#include "esp_netif_sntp.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "clock_sync.h"

static const char *TAG = "clock_sync";
static const int64_t MIN_VALID_UNIXTIME = 1000000000LL;

bool clock_sync_get_unixtime(int64_t *unix_time)
{
    if (unix_time == NULL) {
        return false;
    }

    time_t now;
    time(&now);
    if ((int64_t)now < MIN_VALID_UNIXTIME) {
        return false;
    }

    *unix_time = (int64_t)now;
    return true;
}

static void clock_sync_monitor_task(void *argument)
{
    (void)argument;
    int64_t unix_time;

    while (!clock_sync_get_unixtime(&unix_time)) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }

    ESP_LOGI(TAG, "relógio sincronizado; unixtime=%" PRId64, unix_time);
    vTaskDelete(NULL);
}

esp_err_t clock_sync_start(void)
{
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
    esp_err_t error = esp_netif_sntp_init(&config);
    if (error != ESP_OK) {
        return error;
    }

    if (xTaskCreate(clock_sync_monitor_task, "clock_sync", 3072, NULL, 4, NULL) != pdPASS) {
        return ESP_ERR_NO_MEM;
    }

    ESP_LOGI(TAG, "solicitação de sincronização NTP iniciada");
    return ESP_OK;
}

bool clock_sync_wait(TickType_t timeout_ticks)
{
    if (esp_netif_sntp_sync_wait(timeout_ticks) != ESP_OK) {
        return false;
    }

    int64_t unix_time;
    return clock_sync_get_unixtime(&unix_time);
}
