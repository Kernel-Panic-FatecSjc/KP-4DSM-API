#include <stdbool.h>
#include <stdint.h>

#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_rom_sys.h"
#include "freertos/FreeRTOS.h"

#include "dht22.h"

#define DHT22_START_LOW_US 20000
#define DHT22_EDGE_TIMEOUT_US 120
#define DHT22_BIT_HIGH_TIMEOUT_US 100

static portMUX_TYPE s_dht_mux = portMUX_INITIALIZER_UNLOCKED;
static const char *TAG = "dht22";

static bool wait_for_level(gpio_num_t pin, int level, uint32_t timeout_us)
{
    for (uint32_t elapsed = 0; elapsed < timeout_us; elapsed++) {
        if (gpio_get_level(pin) == level) return true;
        esp_rom_delay_us(1);
    }
    return false;
}

static esp_err_t read_frame(gpio_num_t pin, uint8_t bytes[5])
{
    const gpio_config_t output_config = {
        .pin_bit_mask = 1ULL << pin,
        .mode = GPIO_MODE_INPUT_OUTPUT_OD,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    esp_err_t error = gpio_config(&output_config);
    if (error != ESP_OK) return error;

    if ((error = gpio_set_level(pin, 1)) != ESP_OK) return error;
    esp_rom_delay_us(10);
    if ((error = gpio_set_level(pin, 0)) != ESP_OK) return error;
    esp_rom_delay_us(DHT22_START_LOW_US);
    if ((error = gpio_set_level(pin, 1)) != ESP_OK) return error;

    /* Protect the timing-critical DHT frame from RTOS/Wi-Fi scheduling. */
    portENTER_CRITICAL(&s_dht_mux);
    esp_rom_delay_us(30);

    if (!wait_for_level(pin, 0, DHT22_EDGE_TIMEOUT_US) ||
        !wait_for_level(pin, 1, DHT22_EDGE_TIMEOUT_US) ||
        !wait_for_level(pin, 0, DHT22_EDGE_TIMEOUT_US)) {
        error = ESP_ERR_TIMEOUT;
        goto done;
    }

    for (size_t bit_index = 0; bit_index < 40; bit_index++) {
        if (!wait_for_level(pin, 1, DHT22_EDGE_TIMEOUT_US)) {
            error = ESP_ERR_TIMEOUT;
            goto done;
        }
        uint32_t high_us = 0;
        while (gpio_get_level(pin) == 1 && high_us < DHT22_BIT_HIGH_TIMEOUT_US) {
            esp_rom_delay_us(1);
            high_us++;
        }
        if (high_us >= DHT22_BIT_HIGH_TIMEOUT_US) {
            error = ESP_ERR_TIMEOUT;
            goto done;
        }
        if (high_us > 40) {
            bytes[bit_index / 8] |= (uint8_t)(1U << (7U - (bit_index % 8)));
        }
    }
    error = ESP_OK;

done:
    portEXIT_CRITICAL(&s_dht_mux);
    return error;
}

esp_err_t dht22_read(gpio_num_t pin, float *temperature_c, float *humidity_percent)
{
    if (pin < GPIO_NUM_0 || pin >= GPIO_NUM_34 ||
        (pin >= GPIO_NUM_6 && pin <= GPIO_NUM_11) ||
        temperature_c == NULL || humidity_percent == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    uint8_t bytes[5] = {0};
    esp_err_t error = read_frame(pin, bytes);
    if (error != ESP_OK) return error;
    if ((uint8_t)(bytes[0] + bytes[1] + bytes[2] + bytes[3]) != bytes[4]) {
        return ESP_ERR_INVALID_CRC;
    }

    const uint16_t humidity_raw = ((uint16_t)bytes[0] << 8) | bytes[1];
    const uint16_t temperature_raw = ((uint16_t)bytes[2] << 8) | bytes[3];
    const bool is_negative = (temperature_raw & 0x8000U) != 0;
    const float humidity = (float)humidity_raw / 10.0F;
    float temperature = (float)(temperature_raw & 0x7fffU) / 10.0F;
    if (is_negative) temperature = -temperature;

    if ((temperature_raw & 0x7fffU) > 800U || humidity_raw > 999U) {
        ESP_LOGW(TAG, "quadro fora da faixa válida (umidade=%.1f, temperatura=%.1f)",
                 humidity, temperature);
        return ESP_ERR_INVALID_RESPONSE;
    }
    *temperature_c = temperature;
    *humidity_percent = humidity;
    return ESP_OK;
}
