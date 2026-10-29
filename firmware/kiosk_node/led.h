// Non-blocking RGB LED patterns (the Nano 33 BLE RGB LED is active LOW).
#pragma once

#include <Arduino.h>

void ledBegin();
void ledOff();
void ledSolid(uint8_t r, uint8_t g, uint8_t b);
void ledBreathe(uint8_t r, uint8_t g, uint8_t b);
// Show a colour for durationMs, then turn off.
void ledPulse(uint8_t r, uint8_t g, uint8_t b, uint32_t durationMs);
// One short white blink on top of whatever pattern is showing (gesture feedback).
void ledBlink();
// Call every loop.
void ledUpdate(uint32_t nowMs);
