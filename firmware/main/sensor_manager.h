#pragma once

#include <stddef.h>

#include "driver/gpio.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_err.h"
#include "mqtt_manager.h"

#define SENSOR_MANAGER_MAX_SENSORS MQTT_TELEMETRY_MAX_READINGS
#define SENSOR_MANAGER_SAMPLE_INTERVAL_DEFAULT_MS 300000

typedef enum {
    SENSOR_SOURCE_ADC1,
    SENSOR_SOURCE_RAIN_PULSE,
    SENSOR_SOURCE_WIND_PULSE,
} sensor_source_t;

typedef struct {
    const char *name;
    sensor_source_t source;
    double factor;
    double gain;
    union {
        struct {
            adc_channel_t channel;
            int raw_min;
            int raw_max;
        } adc;
        struct {
            gpio_num_t pin;
            gpio_pull_mode_t pull_mode;
            double millimeters_per_pulse;
        } rain;
        struct {
            gpio_num_t pin;
            gpio_pull_mode_t pull_mode;
            double kilometers_per_hour_per_hz;
        } wind;
    } input;
} sensor_config_t;

typedef void (*sensor_manager_readings_callback_t)(
    const mqtt_telemetry_reading_t *readings,
    size_t reading_count,
    void *context);

esp_err_t sensor_manager_start(const sensor_config_t *sensors,
                               size_t sensor_count,
                               uint32_t sample_interval_ms,
                               sensor_manager_readings_callback_t callback,
                               void *callback_context);
