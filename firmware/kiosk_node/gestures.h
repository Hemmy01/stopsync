// Gestures over the APDS9960, read on their own mbed RTOS thread so voice
// inference in loop() never delays the sensor.
//   GESTURE_SWIPE: the sensor's direction engine (left/right/up/down), confidence 1.00
//   GESTURE_RULE:  tap-count timing rules, confidence 1.00
//   GESTURE_MODEL: Edge Impulse tap model over a 3 s window of prox + clear at 20 Hz
//   GESTURE_OFF:   every call is a no-op
#pragma once

#include "config.h"

// One thing the sensor noticed. loop() reports it as LOG,gesture=<text> with one LED blink.
struct GestureEvent {
  char text[40];      // e.g. "swipe_left" or "tap,ms=180,count=2"
  int destination;    // index into DESTINATIONS, or -1 when it selects nothing
  float confidence;
};

bool gesturesBegin(const char** error);
// Events are only collected between start and stop; stop also drops any still queued.
void gesturesStart();
void gesturesStop();
// Call every loop: true while an event is waiting.
bool gesturesPoll(GestureEvent& out);

// Nearness 0..255 (higher = closer): 255 minus the APDS9960 proximity reading.
// ml/collect/tap_logger uses the same conversion.
static inline int proximityToNearness(int raw) { return raw < 0 ? 0 : 255 - raw; }
