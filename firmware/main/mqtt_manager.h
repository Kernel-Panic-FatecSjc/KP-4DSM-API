#pragma once

#include <stddef.h>

#include "esp_err.h"

#define MQTT_TELEMETRY_MAX_READINGS 50

typedef struct {
    const char *name;
    double value;
} mqtt_telemetry_reading_t;

esp_err_t mqtt_manager_start(void);
esp_err_t mqtt_manager_publish_telemetry(const mqtt_telemetry_reading_t *readings,
                                         size_t reading_count,
                                         const double *latitude,
                                         const double *longitude);
