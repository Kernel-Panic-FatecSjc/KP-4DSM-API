#pragma once

#include <stddef.h>

#include "esp_err.h"

/* FIFO durable; capacity is limited by the configured SPIFFS partition. */
esp_err_t telemetry_queue_start(void);
esp_err_t telemetry_queue_enqueue(const char *payload);
esp_err_t telemetry_queue_peek(char **payload, char *queue_id, size_t queue_id_size);
esp_err_t telemetry_queue_remove(const char *queue_id);
