#pragma once

#include <stdbool.h>

#include "esp_err.h"
#include "freertos/FreeRTOS.h"

esp_err_t wifi_manager_start(void);
bool wifi_manager_wait_connected(TickType_t timeout_ticks);
