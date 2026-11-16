#pragma once

#include "driver/gpio.h"
#include "esp_err.h"

/* Reads AM2302/DHT22 temperature (°C) and relative humidity (%RH). */
esp_err_t dht22_read(gpio_num_t pin, float *temperature_c, float *humidity_percent);
