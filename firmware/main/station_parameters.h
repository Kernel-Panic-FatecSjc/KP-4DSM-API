#pragma once

#include <stddef.h>

#include "esp_err.h"
#include "sensor_manager.h"

/* Applies factor/gain returned by GET /ingestao/estacoes/{vid}/parametros
 * to the local hardware-to-parameter bindings. Unmapped hardware stays raw. */
esp_err_t station_parameters_apply(sensor_config_t *sensors, size_t sensor_count);
