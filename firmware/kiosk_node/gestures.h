// Tap gestures over the APDS9960 proximity sensor.
//   GESTURE_RULE:  timing rules (works now, no ML), confidence 1.00
//   GESTURE_MODEL: Edge Impulse model over a 3 s window of prox + clear at 20 Hz
//   GESTURE_OFF:   every call is a no-op
#pragma once

#include "config.h"

bool gesturesBegin(const char** error);
void gesturesStart();
void gesturesStop();
// Call every loop while listening: true when a gesture selected a stop.
bool gesturesPoll(Choice& out);

// Nearness 0..255 (higher = closer): 255 minus the APDS9960 proximity reading.
// ml/collect/tap_logger uses the same conversion.
static inline int proximityToNearness(int raw) { return raw < 0 ? 0 : 255 - raw; }
