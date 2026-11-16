#pragma once

#define WIFI_SSID "CHANGE_ME"
#define WIFI_PASSWORD "CHANGE_ME"

// Each station is registered in Data Panic with username = VID and password = ingestion key.
#define STATION_VID "CHANGE_ME"
#define STATION_KEY "CHANGE_ME"

#define MQTT_HOST "CHANGE_ME"
#define MQTT_PORT 1883

// Optional fixed position of the station (decimal degrees). Define both or
// neither; without them the platform uses the registered station location.
// #define STATION_LATITUDE -23.1896
// #define STATION_LONGITUDE -45.8841

// Optional override if the ingestion HTTP service is on another host/port.
// The default is MQTT_HOST:3002 on the local development network.
// #define INGESTION_API_HOST "CHANGE_ME"
// #define INGESTION_API_PORT 3002
