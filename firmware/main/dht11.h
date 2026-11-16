#pragma once

#include "driver/gpio.h"
#include "esp_err.h"

/* Reads the DHT11 native temperature (°C) and relative humidity (%). */
esp_err_t dht11_read(gpio_num_t pin, float *temperature_c, float *humidity_percent);
