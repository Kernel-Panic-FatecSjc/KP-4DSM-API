#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"
#include "freertos/FreeRTOS.h"

esp_err_t clock_sync_start(void);
bool clock_sync_wait(TickType_t timeout_ticks);
bool clock_sync_get_unixtime(int64_t *unix_time);
