// StopSync tap logger: streams "prox,clear" at exactly 20 Hz for
// edge-impulse-data-forwarder (Nano 33 BLE Sense Lite, APDS9960).
//
// Same scale and order as firmware/kiosk_node (gestures.cpp):
//   prox  = nearness 0..255, higher = closer (255 minus the APDS9960 reading)
//   clear = raw clear-channel count
// Only numbers are printed, so the data forwarder can detect the frequency.

#include <Arduino_APDS9960.h>

static const uint32_t SAMPLE_HZ = 20;  // = GESTURE_SAMPLE_HZ in kiosk_node/config.h
static const uint32_t PERIOD_US = 1000000UL / SAMPLE_HZ;

static int nearness = 0;
static int clearLevel = 0;
static uint32_t nextSampleUs = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  if (!APDS.begin()) {
    while (true) {
      Serial.println("APDS9960 not found");
      delay(1000);
    }
  }
  nextSampleUs = micros();
}

void loop() {
  if (APDS.proximityAvailable()) {
    int raw = APDS.readProximity();
    nearness = raw < 0 ? 0 : 255 - raw;
  }
  if (APDS.colorAvailable()) {
    int r, g, b, c;
    APDS.readColor(r, g, b, c);
    clearLevel = c;
  }

  uint32_t now = micros();
  if ((int32_t)(now - nextSampleUs) >= 0) {
    nextSampleUs += PERIOD_US;
    Serial.print(nearness);
    Serial.print(',');
    Serial.println(clearLevel);
  }
}
