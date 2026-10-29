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
#define GESTURE_SWIPE 3

#ifndef VOICE_MODE
#define VOICE_MODE   VOICE_MODEL    // VOICE_MODEL | VOICE_OFF
#endif
#ifndef GESTURE_MODE
#define GESTURE_MODE GESTURE_SWIPE  // GESTURE_SWIPE | GESTURE_MODEL | GESTURE_RULE | GESTURE_OFF
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
#define FW_VERSION "0.3.0"           // reported on connect: LOG,voice=…,gesture=…,fw=<version>
#define SERIAL_WAIT_MS 2000          // boot waits at most this long for a host, then runs anyway

// ---------------------------------------------------------------------------
// Destinations: must match apps/web/lib/destinations.ts and supabase/seed.sql
// (apps/web/tests/firmware-config.test.ts parses the table below).
// gestureLabel is the swipe (GESTURE_SWIPE); tapLabel is the tap pattern used by
// GESTURE_RULE and the Edge Impulse tap model (GESTURE_MODEL).
// LED colour is r, g, b from 0 to 255; the RGB LED is active LOW.
// ---------------------------------------------------------------------------
struct Destination {
  const char* code;
  const char* route;
  const char* voiceLabel;
  const char* gestureLabel;
  const char* tapLabel;
  uint8_t r, g, b;
};

static const Destination DESTINATIONS[] = {
  // code   route  voice label   gesture label   tap label       LED r, g, b
  { "REM", "R2",  "remera",     "swipe_left",   "one_tap",      0,   255, 0   },  // green
  { "DTN", "R4",  "downtown",   "swipe_right",  "two_taps",     160, 0,   255 },  // purple
  { "NYA", "R1",  "nyabugogo",  "swipe_up",     "three_taps",   0,   0,   255 },  // blue
  { "KIM", "R3",  "kimironko",  "swipe_down",   "hold",         255, 140, 0   },  // yellow
};
static const int DESTINATION_COUNT = sizeof(DESTINATIONS) / sizeof(DESTINATIONS[0]);
// Labels that never select anything: voice noise, unknown; tap model passing, idle.

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

static inline int destinationForTapLabel(const char* label) {
  for (int i = 0; i < DESTINATION_COUNT; i++) {
    if (strcmp(label, DESTINATIONS[i].tapLabel) == 0) return i;
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
#define GESTURE_THRESHOLD    0.80f  // tap model (GESTURE_MODEL)
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

// ---------------------------------------------------------------------------
// Swipes (GESTURE_SWIPE): the APDS9960's own direction engine, no ML.
// Mount the board, swipe left over it and watch LOG,gesture=swipe_...:
//   says swipe_right       -> SWIPE_FLIP_X 1
//   says swipe_up / _down  -> SWIPE_SWAP_AXES 1 (then check the flips again)
// Applied in this order: swap, then flip X, then flip Y.
// ---------------------------------------------------------------------------
#ifndef SWIPE_SWAP_AXES
#define SWIPE_SWAP_AXES 0        // 1 = board turned 90 degrees: left/right <-> up/down
#endif
#ifndef SWIPE_FLIP_X
#define SWIPE_FLIP_X    0        // 1 = left <-> right
#endif
#ifndef SWIPE_FLIP_Y
#define SWIPE_FLIP_Y    0        // 1 = up <-> down
#endif
#define SWIPE_SENSITIVITY 80     // 1..100, library default 80; raise if swipes are missed

// ---------------------------------------------------------------------------
// Sensor thread: the APDS9960 is read on its own mbed RTOS thread, so voice
// inference in loop() never delays it. Every gesture event is reported as
// LOG,gesture=<event> and blinks the LED once.
// ---------------------------------------------------------------------------
#define SENSOR_POLL_MS      10    // swipe engine and tap rules poll period
#define SENSOR_STACK_BYTES  3072
#define GESTURE_QUEUE_SIZE  8     // events waiting for loop(); extra events are dropped

// ---------------------------------------------------------------------------
// LED
// ---------------------------------------------------------------------------
#define LED_USE_PWM       1     // 0 = on/off only (if analogWrite misbehaves)
#define LED_BREATHE_MS    2000  // listening: one breath
#define LED_ACK_PULSE_MS  600   // ACK: short green pulse
#define LED_BLINK_MS      120   // one white blink per gesture event
