#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "driver/gpio.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_check.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "sensor_manager.h"

typedef struct {
    sensor_config_t config;
    volatile uint32_t pulse_count;
} sensor_runtime_t;

static const char *TAG = "sensors";
static sensor_runtime_t s_sensors[SENSOR_MANAGER_MAX_SENSORS];
static size_t s_sensor_count;
static adc_oneshot_unit_handle_t s_adc_unit;
static esp_timer_handle_t s_sample_timer;
static TaskHandle_t s_sample_task;
static sensor_manager_readings_callback_t s_callback;
static void *s_callback_context;
static int64_t s_previous_sample_us;
static portMUX_TYPE s_pulse_mux = portMUX_INITIALIZER_UNLOCKED;

static bool gpio_is_safe_input(gpio_num_t pin)
{
    return pin >= GPIO_NUM_0 && pin < GPIO_NUM_MAX &&
           !(pin >= GPIO_NUM_6 && pin <= GPIO_NUM_11);
}

static bool pull_mode_is_valid(gpio_pull_mode_t mode)
{
    return mode == GPIO_FLOATING || mode == GPIO_PULLUP_ONLY ||
           mode == GPIO_PULLDOWN_ONLY;
}

static esp_err_t validate_sensor_config(const sensor_config_t *sensor)
{
    if (sensor->name == NULL || sensor->name[0] == '\0' ||
        strlen(sensor->name) > 120 || !isfinite(sensor->factor) ||
        sensor->factor == 0.0 || !isfinite(sensor->gain)) {
        return ESP_ERR_INVALID_ARG;
    }

    switch (sensor->source) {
    case SENSOR_SOURCE_ADC1:
        if (sensor->input.adc.channel < ADC_CHANNEL_0 ||
            sensor->input.adc.channel > ADC_CHANNEL_7 ||
            sensor->input.adc.raw_min < 0 ||
            sensor->input.adc.raw_max > 4095 ||
            sensor->input.adc.raw_min > sensor->input.adc.raw_max) {
            return ESP_ERR_INVALID_ARG;
        }
        break;
    case SENSOR_SOURCE_RAIN_PULSE:
        if (!gpio_is_safe_input(sensor->input.rain.pin) ||
            !pull_mode_is_valid(sensor->input.rain.pull_mode) ||
            !isfinite(sensor->input.rain.millimeters_per_pulse) ||
            sensor->input.rain.millimeters_per_pulse <= 0.0) {
            return ESP_ERR_INVALID_ARG;
        }
        break;
    case SENSOR_SOURCE_WIND_PULSE:
        if (!gpio_is_safe_input(sensor->input.wind.pin) ||
            !pull_mode_is_valid(sensor->input.wind.pull_mode) ||
            !isfinite(sensor->input.wind.kilometers_per_hour_per_hz) ||
            sensor->input.wind.kilometers_per_hour_per_hz <= 0.0) {
            return ESP_ERR_INVALID_ARG;
        }
        break;
    default:
        return ESP_ERR_INVALID_ARG;
    }

    return ESP_OK;
}

static bool has_source(sensor_source_t source)
{
    for (size_t index = 0; index < s_sensor_count; index++) {
        if (s_sensors[index].config.source == source) {
            return true;
        }
    }
    return false;
}

static void pulse_isr_handler(void *argument)
{
    sensor_runtime_t *sensor = argument;
    portENTER_CRITICAL_ISR(&s_pulse_mux);
    sensor->pulse_count++;
    portEXIT_CRITICAL_ISR(&s_pulse_mux);
}

static esp_err_t configure_adc(void)
{
    const adc_oneshot_unit_init_cfg_t unit_config = {
        .unit_id = ADC_UNIT_1,
    };
    ESP_RETURN_ON_ERROR(adc_oneshot_new_unit(&unit_config, &s_adc_unit), TAG,
                        "falha ao inicializar ADC1");

    const adc_oneshot_chan_cfg_t channel_config = {
        .bitwidth = ADC_BITWIDTH_DEFAULT,
        .atten = ADC_ATTEN_DB_12,
    };
    for (size_t index = 0; index < s_sensor_count; index++) {
        const sensor_config_t *sensor = &s_sensors[index].config;
        if (sensor->source != SENSOR_SOURCE_ADC1) {
            continue;
        }
        ESP_RETURN_ON_ERROR(
            adc_oneshot_config_channel(s_adc_unit, sensor->input.adc.channel,
                                       &channel_config),
            TAG, "falha ao configurar canal ADC1");
    }
    return ESP_OK;
}

static esp_err_t configure_pulse_inputs(void)
{
    esp_err_t error = gpio_install_isr_service(0);
    if (error != ESP_OK && error != ESP_ERR_INVALID_STATE) {
        return error;
    }

    for (size_t index = 0; index < s_sensor_count; index++) {
        const sensor_config_t *sensor = &s_sensors[index].config;
        gpio_num_t pin;
        gpio_pull_mode_t pull_mode;
        if (sensor->source == SENSOR_SOURCE_RAIN_PULSE) {
            pin = sensor->input.rain.pin;
            pull_mode = sensor->input.rain.pull_mode;
        } else if (sensor->source == SENSOR_SOURCE_WIND_PULSE) {
            pin = sensor->input.wind.pin;
            pull_mode = sensor->input.wind.pull_mode;
        } else {
            continue;
        }

        const gpio_config_t pin_config = {
            .pin_bit_mask = 1ULL << pin,
            .mode = GPIO_MODE_INPUT,
            .pull_up_en = pull_mode == GPIO_PULLUP_ONLY ? GPIO_PULLUP_ENABLE : GPIO_PULLUP_DISABLE,
            .pull_down_en = pull_mode == GPIO_PULLDOWN_ONLY ? GPIO_PULLDOWN_ENABLE : GPIO_PULLDOWN_DISABLE,
            .intr_type = GPIO_INTR_POSEDGE,
        };
        ESP_RETURN_ON_ERROR(gpio_config(&pin_config), TAG,
                            "falha ao configurar entrada de pulsos");
        ESP_RETURN_ON_ERROR(
            gpio_isr_handler_add(pin, pulse_isr_handler, &s_sensors[index]),
            TAG, "falha ao registrar interrupção do sensor");
    }
    return ESP_OK;
}

static uint32_t take_pulses(sensor_runtime_t *sensor)
{
    portENTER_CRITICAL(&s_pulse_mux);
    uint32_t pulses = sensor->pulse_count;
    sensor->pulse_count = 0;
    portEXIT_CRITICAL(&s_pulse_mux);
    return pulses;
}

static bool sample_sensor(sensor_runtime_t *sensor,
                          double elapsed_seconds,
                          double *value)
{
    const sensor_config_t *config = &sensor->config;
    double raw_value;

    if (config->source == SENSOR_SOURCE_ADC1) {
        int raw_adc;
        if (adc_oneshot_read(s_adc_unit, config->input.adc.channel, &raw_adc) != ESP_OK ||
            raw_adc < config->input.adc.raw_min ||
            raw_adc > config->input.adc.raw_max) {
            ESP_LOGW(TAG, "leitura analógica inválida; sensor ignorado");
            return false;
        }
        raw_value = (double)raw_adc;
    } else {
        uint32_t pulses = take_pulses(sensor);
        if (config->source == SENSOR_SOURCE_RAIN_PULSE) {
            raw_value = (double)pulses * config->input.rain.millimeters_per_pulse;
        } else {
            raw_value = ((double)pulses / elapsed_seconds) *
                        config->input.wind.kilometers_per_hour_per_hz;
        }
    }

    *value = raw_value * config->factor + config->gain;
    if (!isfinite(*value)) {
        ESP_LOGW(TAG, "resultado não finito; sensor ignorado");
        return false;
    }
    return true;
}

static void collect_readings(void)
{
    const int64_t now_us = esp_timer_get_time();
    const double elapsed_seconds = (double)(now_us - s_previous_sample_us) / 1000000.0;
    s_previous_sample_us = now_us;
    if (elapsed_seconds <= 0.0) {
        return;
    }

    mqtt_telemetry_reading_t readings[SENSOR_MANAGER_MAX_SENSORS];
    size_t valid_count = 0;
    for (size_t index = 0; index < s_sensor_count; index++) {
        double value;
        if (sample_sensor(&s_sensors[index], elapsed_seconds, &value)) {
            readings[valid_count].name = s_sensors[index].config.name;
            readings[valid_count].value = value;
            valid_count++;
        }
    }

    if (valid_count > 0) {
        s_callback(readings, valid_count, s_callback_context);
    } else {
        ESP_LOGW(TAG, "nenhuma leitura válida neste ciclo");
    }
}

static void sample_timer_callback(void *argument)
{
    (void)argument;
    if (s_sample_task != NULL) {
        xTaskNotifyGive(s_sample_task);
    }
}

static void sample_task(void *argument)
{
    (void)argument;
    for (;;) {
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        collect_readings();
    }
}

esp_err_t sensor_manager_start(const sensor_config_t *sensors,
                               size_t sensor_count,
                               uint32_t sample_interval_ms,
                               sensor_manager_readings_callback_t callback,
                               void *callback_context)
{
    if (sensor_count == 0) {
        ESP_LOGW(TAG, "nenhum sensor configurado; GPIOs permanecem desativados");
        return ESP_OK;
    }
    if (sensors == NULL || callback == NULL ||
        sensor_count > SENSOR_MANAGER_MAX_SENSORS ||
        sample_interval_ms == 0) {
        return ESP_ERR_INVALID_ARG;
    }

    for (size_t index = 0; index < sensor_count; index++) {
        ESP_RETURN_ON_ERROR(validate_sensor_config(&sensors[index]), TAG,
                            "configuração de sensor inválida");
        for (size_t previous = 0; previous < index; previous++) {
            if (strcmp(sensors[index].name, sensors[previous].name) == 0) {
                return ESP_ERR_INVALID_ARG;
            }
        }
    }

    for (size_t index = 0; index < sensor_count; index++) {
        s_sensors[index].config = sensors[index];
        s_sensors[index].pulse_count = 0;
    }
    s_sensor_count = sensor_count;
    s_callback = callback;
    s_callback_context = callback_context;
    s_previous_sample_us = esp_timer_get_time();

    if (has_source(SENSOR_SOURCE_ADC1)) {
        ESP_RETURN_ON_ERROR(configure_adc(), TAG, "falha ao inicializar sensores analógicos");
    }
    if (has_source(SENSOR_SOURCE_RAIN_PULSE) ||
        has_source(SENSOR_SOURCE_WIND_PULSE)) {
        ESP_RETURN_ON_ERROR(configure_pulse_inputs(), TAG,
                            "falha ao inicializar sensores de pulso");
    }

    if (xTaskCreate(sample_task, "sensor_sample", 4096, NULL, 5,
                    &s_sample_task) != pdPASS) {
        return ESP_ERR_NO_MEM;
    }

    const esp_timer_create_args_t timer_config = {
        .callback = sample_timer_callback,
        .name = "sensor_sample",
    };
    ESP_RETURN_ON_ERROR(esp_timer_create(&timer_config, &s_sample_timer), TAG,
                        "falha ao criar timer de amostragem");
    ESP_RETURN_ON_ERROR(
        esp_timer_start_periodic(s_sample_timer,
                                 (uint64_t)sample_interval_ms * 1000ULL),
        TAG, "falha ao iniciar timer de amostragem");

    ESP_LOGI(TAG, "%u sensor(es) configurado(s); amostragem a cada %u ms",
             (unsigned)s_sensor_count, (unsigned)sample_interval_ms);
    return ESP_OK;
}
