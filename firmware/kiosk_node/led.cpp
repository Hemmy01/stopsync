#include "led.h"

#include "config.h"

enum class Pattern { Off, Solid, Breathe, Pulse };

static Pattern pattern = Pattern::Off;
static uint8_t baseR = 0, baseG = 0, baseB = 0;
static uint32_t patternStart = 0;
static uint32_t pulseMs = 0;
static bool blinking = false;
static uint32_t blinkStart = 0;
static int lastR = -1, lastG = -1, lastB = -1;

static void writeChannel(pin_size_t pin, uint8_t level, int& last) {
  if (level == last) return;
  last = level;
#if LED_USE_PWM
  analogWrite(pin, 255 - level);  // active LOW
#else
  digitalWrite(pin, level >= 128 ? LOW : HIGH);
#endif
}

static void write(uint8_t r, uint8_t g, uint8_t b) {
  writeChannel(LEDR, r, lastR);
  writeChannel(LEDG, g, lastG);
  writeChannel(LEDB, b, lastB);
}

static void set(Pattern p, uint8_t r, uint8_t g, uint8_t b) {
  pattern = p;
  baseR = r;
  baseG = g;
  baseB = b;
  patternStart = millis();
}

void ledBegin() {
  pinMode(LEDR, OUTPUT);
  pinMode(LEDG, OUTPUT);
  pinMode(LEDB, OUTPUT);
  write(0, 0, 0);
}

void ledOff() { set(Pattern::Off, 0, 0, 0); }
void ledSolid(uint8_t r, uint8_t g, uint8_t b) { set(Pattern::Solid, r, g, b); }
void ledBreathe(uint8_t r, uint8_t g, uint8_t b) { set(Pattern::Breathe, r, g, b); }

void ledBlink() {
  blinking = true;
  blinkStart = millis();
}

void ledPulse(uint8_t r, uint8_t g, uint8_t b, uint32_t durationMs) {
  set(Pattern::Pulse, r, g, b);
  pulseMs = durationMs;
}

void ledUpdate(uint32_t nowMs) {
  if (blinking) {
    if (nowMs - blinkStart < LED_BLINK_MS) {
      write(255, 255, 255);
      return;
    }
    blinking = false;
  }
  switch (pattern) {
    case Pattern::Off:
      write(0, 0, 0);
      break;
    case Pattern::Solid:
      write(baseR, baseG, baseB);
      break;
    case Pattern::Breathe: {
      // Triangle wave from 10% to 100% brightness: calm, never fully dark.
      uint32_t phase = (nowMs - patternStart) % LED_BREATHE_MS;
      uint32_t half = LED_BREATHE_MS / 2;
      uint32_t ramp = phase < half ? phase : LED_BREATHE_MS - phase;
      uint32_t level = 25 + (230 * ramp) / half;
#if !LED_USE_PWM
      level = phase < half ? 255 : 0;  // blink when PWM is off
#endif
      write(baseR * level / 255, baseG * level / 255, baseB * level / 255);
      break;
    }
    case Pattern::Pulse:
      if (nowMs - patternStart >= pulseMs) {
        pattern = Pattern::Off;
        write(0, 0, 0);
      } else {
        write(baseR, baseG, baseB);
      }
      break;
  }
}
