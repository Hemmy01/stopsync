// StopSync kiosk node: every build switch and tunable lives here.
// See firmware/README.md for what each combination needs.
#pragma once

#include <Arduino.h>

// ---------------------------------------------------------------------------
// Build switches (can also be overridden with -D flags, see scripts/compile-all.sh)
// ---------------------------------------------------------------------------
#define VOICE_OFF   0
#define VOICE_MODEL 1

#define GESTURE_OFF   0
#define GESTURE_RULE  1
#define GESTURE_MODEL 2

#ifndef VOICE_MODE
#define VOICE_MODE   VOICE_MODEL    // VOICE_MODEL | VOICE_OFF
#endif
#ifndef GESTURE_MODE
#define GESTURE_MODE GESTURE_RULE   // GESTURE_MODEL | GESTURE_RULE | GESTURE_OFF
#endif

// How the Edge Impulse libraries are packaged (only matters with a *_MODEL mode).
#define EI_SEPARATE      0  // one Edge Impulse Arduino library per build
#define EI_MULTI_IMPULSE 1  // one merged library holding both impulses (README option 1)
#ifndef EI_LAYOUT
#define EI_LAYOUT EI_SEPARATE
#endif

// Edge Impulse library headers: the only place their names appear.
// The header is "<project name>_inferencing.h" from the exported zip.
#ifndef VOICE_MODEL_HEADER
#define VOICE_MODEL_HEADER   <tap-and-select-voice_inferencing.h>  // ml/exports, project 1150179
#endif
#ifndef GESTURE_MODEL_HEADER
#define GESTURE_MODEL_HEADER <stopsync_gestures_inferencing.h>
#endif
#ifndef MULTI_MODEL_HEADER
#define MULTI_MODEL_HEADER   <stopsync_multi_inferencing.h>
#endif
// Multi-impulse only: handle names from the merged model_variables.h
// ("ei_impulse_handle_t impulse_handle_<project>_<version>").
#define VOICE_IMPULSE_HANDLE   impulse_handle_00000_1
#define GESTURE_IMPULSE_HANDLE impulse_handle_00000_2

#if VOICE_MODE == VOICE_MODEL && GESTURE_MODE == GESTURE_MODEL && EI_LAYOUT == EI_SEPARATE
#error "Two separate Edge Impulse libraries clash in one sketch. Use EI_LAYOUT EI_MULTI_IMPULSE, \
or GESTURE_RULE with the voice model, or two builds. See firmware/README.md."
#endif

// ---------------------------------------------------------------------------
// Identity and serial
// ---------------------------------------------------------------------------
#define STOP_ID   "STOP-01"
#define BAUD_RATE 115200
#define FW_VERSION "0.2.0"           // reported on connect: LOG,voice=…,gesture=…,fw=<version>
#define SERIAL_WAIT_MS 2000          // boot waits at most this long for a host, then runs anyway

// ---------------------------------------------------------------------------
// Destinations: must match apps/web/lib/destinations.ts and supabase/seed.sql
// (apps/web/tests/firmware-config.test.ts parses the table below).
// LED colour is r, g, b from 0 to 255; the RGB LED is active LOW.
// ---------------------------------------------------------------------------
struct Destination {
  const char* code;
  const char* route;
  const char* voiceLabel;
  const char* gestureLabel;
  uint8_t r, g, b;
};

static const Destination DESTINATIONS[] = {
  // code   route  voice label   gesture label   LED r, g, b
  { "REM", "R2",  "remera",     "one_tap",      0,   255, 0   },  // green
  { "DTN", "R4",  "downtown",   "two_taps",     160, 0,   255 },  // purple
  { "NYA", "R1",  "nyabugogo",  "three_taps",   0,   0,   255 },  // blue
  { "KIM", "R3",  "kimironko",  "hold",         255, 140, 0   },  // yellow
};
static const int DESTINATION_COUNT = sizeof(DESTINATIONS) / sizeof(DESTINATIONS[0]);
// Labels that never select anything: voice noise, unknown; gesture passing, idle.

// A passenger's choice from either input: index into DESTINATIONS + confidence 0..1.
struct Choice {
  int destination;
  float confidence;
};

static inline int destinationForVoiceLabel(const char* label) {
  for (int i = 0; i < DESTINATION_COUNT; i++) {
    if (strcmp(label, DESTINATIONS[i].voiceLabel) == 0) return i;
  }
  return -1;
}

static inline int destinationForGestureLabel(const char* label) {
  for (int i = 0; i < DESTINATION_COUNT; i++) {
    if (strcmp(label, DESTINATIONS[i].gestureLabel) == 0) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// State machine timeouts (safety net in case the kiosk goes quiet)
// ---------------------------------------------------------------------------
#define LISTEN_TIMEOUT_MS   25000UL
#define WAIT_ACK_TIMEOUT_MS 30000UL

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------
#define VOICE_THRESHOLD      0.80f  // stop label score needed...
#define VOICE_CONSECUTIVE    2      // ...for this many results in a row
// Results per 1 s model window (Edge Impulse continuous mode): 4 = one result every
// 250 ms, as in the reference example. Use 3 if the board logs voice_overrun.
#ifndef VOICE_SLICES_PER_WINDOW
#define VOICE_SLICES_PER_WINDOW 4
#endif
// 1 = send "LOG,scores,<label>=<value>,..." once per model window (~1 s) while
// listening, for tuning VOICE_THRESHOLD from the kiosk debug drawer.
#ifndef DEBUG_SCORES
#define DEBUG_SCORES         0
#endif
#define GESTURE_THRESHOLD    0.80f
#define GESTURE_CONSECUTIVE  2
#define GESTURE_SAMPLE_HZ    20     // prox + clear frames per second (tap_logger uses the same)
#define GESTURE_WINDOW_FRAMES 60    // 3 s ring buffer
#define GESTURE_AXES         2      // prox, clear
#define GESTURE_CLASSIFY_MS  250

// ---------------------------------------------------------------------------
// Rule-based tap detector (GESTURE_RULE). Proximity is "nearness" 0..255,
// higher = closer (255 minus the APDS9960 reading). Tune with LOG output.
// ---------------------------------------------------------------------------
#define PROX_NEAR_THRESHOLD 150  // nearness at or above this = hand near
#define PROX_FAR_THRESHOLD  80   // nearness at or below this = hand away (hysteresis)
#define TAP_MAX_MS          600  // near -> away within this = one tap
#define TAP_GROUP_GAP_MS    700  // next tap starts within this after the last one = same group
#define TAP_GROUP_CLOSE_MS  900  // group closes after this long with no tap
#define HOLD_MS             1800 // near this long = hold
#define GESTURE_RULE_LOG    1    // 1 = LOG every tap and group (handy for tuning)

// ---------------------------------------------------------------------------
// LED
// ---------------------------------------------------------------------------
#define LED_USE_PWM       1     // 0 = on/off only (if analogWrite misbehaves)
#define LED_BREATHE_MS    2000  // listening: one breath
#define LED_ACK_PULSE_MS  600   // ACK: short green pulse
