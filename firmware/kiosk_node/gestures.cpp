#include "gestures.h"

#if GESTURE_MODE != GESTURE_OFF

#include <Arduino_APDS9960.h>
#include <mbed.h>
#include <stdarg.h>

#include "protocol.h"

// ---------------------------------------------------------------------------
// Shared between the sensor thread (producer) and loop() (consumer).
// Every access holds a CriticalSectionLock; each one is a few word copies.
// ---------------------------------------------------------------------------
static GestureEvent queue[GESTURE_QUEUE_SIZE];
static int queueHead = 0;  // next event to read
static int queueCount = 0;
static bool active = false;
static uint32_t session = 0;  // bumped on every start, so the thread resets its detector

#if GESTURE_MODE == GESTURE_MODEL
static const std::chrono::milliseconds SENSOR_PERIOD(1000 / GESTURE_SAMPLE_HZ);
#else
static const std::chrono::milliseconds SENSOR_PERIOD(SENSOR_POLL_MS);
#endif

static rtos::Thread sensorThread(osPriorityAboveNormal, SENSOR_STACK_BYTES, nullptr, "gestures");

// Thread side: queue an event, unless listening stopped or restarted meanwhile.
static void pushEvent(uint32_t forSession, int destination, float confidence, const char* fmt, ...) {
  GestureEvent event;
  va_list args;
  va_start(args, fmt);
  vsnprintf(event.text, sizeof(event.text), fmt, args);
  va_end(args);
  event.destination = destination;
  event.confidence = confidence;

  mbed::CriticalSectionLock lock;
  if (!active || session != forSession || queueCount >= GESTURE_QUEUE_SIZE) return;
  queue[(queueHead + queueCount) % GESTURE_QUEUE_SIZE] = event;
  queueCount++;
}

static bool popEvent(GestureEvent& out) {
  mbed::CriticalSectionLock lock;
  if (queueCount == 0) return false;
  out = queue[queueHead];
  queueHead = (queueHead + 1) % GESTURE_QUEUE_SIZE;
  queueCount--;
  return true;
}

// Each mode below defines these. They run on the sensor thread, except detectorBegin
// (setup, before the thread starts) and the model's loop-side functions.
static bool detectorBegin(const char** error);
static void detectorReset();                       // listening (re)started
static void detectorStep(bool on, uint32_t forSession);  // every SENSOR_PERIOD, even when idle

static void sensorLoop() {
  uint32_t seen = 0;
  rtos::Kernel::Clock::time_point next = rtos::Kernel::Clock::now();
  while (true) {
    bool on;
    uint32_t current;
    {
      mbed::CriticalSectionLock lock;
      on = active;
      current = session;
    }
    if (on && current != seen) {
      seen = current;
      detectorReset();
    }
    detectorStep(on, seen);

    next += SENSOR_PERIOD;
    rtos::Kernel::Clock::time_point now = rtos::Kernel::Clock::now();
    if (next < now) next = now;  // fell behind: carry on rather than burst
    rtos::ThisThread::sleep_until(next);
  }
}

// ---------------------------------------------------------------------------
#if GESTURE_MODE == GESTURE_SWIPE

// Indexed by the library's GESTURE_UP, GESTURE_DOWN, GESTURE_LEFT, GESTURE_RIGHT (0..3).
static const char* const SWIPE_LABELS[] = {"swipe_up", "swipe_down", "swipe_left", "swipe_right"};

// The library's direction as seen by the passenger, after SWIPE_SWAP_AXES / SWIPE_FLIP_*.
static int orient(int gesture) {
  int x = 0, y = 0;
  switch (gesture) {
    case GESTURE_LEFT:  x = -1; break;
    case GESTURE_RIGHT: x = 1;  break;
    case GESTURE_UP:    y = 1;  break;
    case GESTURE_DOWN:  y = -1; break;
    default: return GESTURE_NONE;
  }
#if SWIPE_SWAP_AXES
  int t = x;
  x = y;
  y = t;
#endif
#if SWIPE_FLIP_X
  x = -x;
#endif
#if SWIPE_FLIP_Y
  y = -y;
#endif
  if (x < 0) return GESTURE_LEFT;
  if (x > 0) return GESTURE_RIGHT;
  return y > 0 ? GESTURE_UP : GESTURE_DOWN;
}

static bool detectorBegin(const char**) {
  APDS.setGestureSensitivity(SWIPE_SENSITIVITY);
  return true;
}

static void detectorReset() {}

static void detectorStep(bool on, uint32_t forSession) {
  // Poll even when idle so the sensor's FIFO never holds a stale swipe.
  if (!APDS.gestureAvailable()) return;
  int gesture = orient(APDS.readGesture());
  if (!on || gesture == GESTURE_NONE) return;
  const char* label = SWIPE_LABELS[gesture];
  pushEvent(forSession, destinationForGestureLabel(label), 1.0f, "%s", label);
}

// ---------------------------------------------------------------------------
#elif GESTURE_MODE == GESTURE_RULE

enum class Hand { Away, Near };

// Sensor thread only.
static int nearness = 0;  // latest proximity, 0..255, higher = closer
static Hand hand = Hand::Away;
static uint32_t nearSince = 0;
static uint32_t lastTapEnd = 0;
static int taps = 0;
static bool holdFired = false;
static bool waitForAway = false;  // hand was already near when listening started

static void closeGroup(uint32_t forSession) {
  static const char* const LABELS[] = {"", "one_tap", "two_taps", "three_taps"};
  int count = taps;
  taps = 0;
  if (count < 1 || count > 3) {
    pushEvent(forSession, -1, 1.0f, "ignored,taps=%d", count);
    return;
  }
  pushEvent(forSession, destinationForTapLabel(LABELS[count]), 1.0f, "%s", LABELS[count]);
}

static bool detectorBegin(const char**) { return true; }

static void detectorReset() {
  hand = nearness >= PROX_NEAR_THRESHOLD ? Hand::Near : Hand::Away;
  waitForAway = hand == Hand::Near;
  taps = 0;
  holdFired = false;
}

static void detectorStep(bool on, uint32_t forSession) {
  // Keep reading while idle so detectorReset() sees where the hand is now.
  if (APDS.proximityAvailable()) nearness = proximityToNearness(APDS.readProximity());
  if (!on) return;
  uint32_t now = millis();

  if (hand == Hand::Away && nearness >= PROX_NEAR_THRESHOLD) {
    hand = Hand::Near;
    nearSince = now;
    // A new press long after the last tap: the previous group is finished.
    if (taps > 0 && now - lastTapEnd >= TAP_GROUP_GAP_MS) closeGroup(forSession);
    return;
  }
  if (hand == Hand::Near && nearness <= PROX_FAR_THRESHOLD) {
    hand = Hand::Away;
    uint32_t held = now - nearSince;
    if (waitForAway || holdFired) {
      waitForAway = false;
      holdFired = false;
    } else if (held <= TAP_MAX_MS) {
      taps++;
      lastTapEnd = now;
      pushEvent(forSession, -1, 1.0f, "tap,ms=%lu,count=%d", (unsigned long)held, taps);
    } else {
      pushEvent(forSession, -1, 1.0f, "slow_press,ms=%lu", (unsigned long)held);
      taps = 0;
    }
  } else if (hand == Hand::Near && !waitForAway && !holdFired && now - nearSince >= HOLD_MS) {
    holdFired = true;
    taps = 0;
    pushEvent(forSession, destinationForTapLabel("hold"), 1.0f, "hold");
    return;
  }

  if (hand == Hand::Away && taps > 0 && now - lastTapEnd >= TAP_GROUP_CLOSE_MS) closeGroup(forSession);
}

// ---------------------------------------------------------------------------
#elif GESTURE_MODE == GESTURE_MODEL

#include "models.h"

static const int FEATURES = GESTURE_WINDOW_FRAMES * GESTURE_AXES;

// Shared (CriticalSectionLock): written by the thread at GESTURE_SAMPLE_HZ, read by loop().
static float ring[FEATURES];  // frame i at ring[i*2], ring[i*2+1]
static int head = 0;          // next frame slot
static int filled = 0;        // frames since start / last clear

// Sensor thread only.
static int nearness = 0;
static int clearLevel = 0;

// loop() only.
static float features[FEATURES];
static uint32_t lastClassifyMs = 0;
static int lastDestination = -1;
static int streak = 0;

static bool detectorBegin(const char** error) {
  if (gestureModelFeatureCount() != (uint32_t)FEATURES) {
    *error = "gesture=model input size != 60 frames x 2";
    return false;
  }
  return true;
}

static void detectorReset() {}  // gesturesStart() clears the window itself

static void detectorStep(bool on, uint32_t) {
  if (APDS.proximityAvailable()) nearness = proximityToNearness(APDS.readProximity());
  if (APDS.colorAvailable()) {
    int r, g, b, c;
    APDS.readColor(r, g, b, c);
    clearLevel = c;
  }
  if (!on) return;
  mbed::CriticalSectionLock lock;
  ring[head * 2] = (float)nearness;
  ring[head * 2 + 1] = (float)clearLevel;
  head = (head + 1) % GESTURE_WINDOW_FRAMES;
  if (filled < GESTURE_WINDOW_FRAMES) filled++;
}

static void clearWindow() {
  {
    mbed::CriticalSectionLock lock;
    head = 0;
    filled = 0;
  }
  lastDestination = -1;
  streak = 0;
}

// loop(): classify the newest 3 s every GESTURE_CLASSIFY_MS.
static bool modelPoll(GestureEvent& out) {
  if (!active) return false;  // only loop() writes it
  uint32_t nowMs = millis();
  if (nowMs - lastClassifyMs < GESTURE_CLASSIFY_MS) return false;
  {
    mbed::CriticalSectionLock lock;
    if (filled < GESTURE_WINDOW_FRAMES) return false;
    // Oldest frame first.
    for (int i = 0; i < GESTURE_WINDOW_FRAMES; i++) {
      int frame = (head + i) % GESTURE_WINDOW_FRAMES;
      features[i * 2] = ring[frame * 2];
      features[i * 2 + 1] = ring[frame * 2 + 1];
    }
  }
  lastClassifyMs = nowMs;

  ModelScore best;
  if (!gestureModelClassify(features, best)) {
    sendLog("gesture=classifier error");
    return false;
  }

  int destination = destinationForTapLabel(best.label);
  if (destination < 0 || best.value < GESTURE_THRESHOLD) {
    lastDestination = -1;
    streak = 0;
    return false;
  }
  streak = destination == lastDestination ? streak + 1 : 1;
  lastDestination = destination;
  if (streak < GESTURE_CONSECUTIVE) return false;

  snprintf(out.text, sizeof(out.text), "%s", best.label);
  out.destination = destination;
  out.confidence = best.value;
  clearWindow();  // never re-detect the same movement
  return true;
}

#endif

// ---------------------------------------------------------------------------
// Common to every mode.

bool gesturesBegin(const char** error) {
  if (!APDS.begin()) {
    *error = "gesture=APDS9960 not found";
    return false;
  }
  if (!detectorBegin(error)) return false;
  if (sensorThread.start(mbed::callback(sensorLoop)) != osOK) {
    *error = "gesture=sensor thread failed";
    return false;
  }
  return true;
}

void gesturesStart() {
  {
    mbed::CriticalSectionLock lock;
    queueCount = 0;
    session++;
    active = true;
  }
#if GESTURE_MODE == GESTURE_MODEL
  clearWindow();
  lastClassifyMs = millis();
#endif
}

void gesturesStop() {
  mbed::CriticalSectionLock lock;
  active = false;
  queueCount = 0;
}

bool gesturesPoll(GestureEvent& out) {
  if (popEvent(out)) return true;
#if GESTURE_MODE == GESTURE_MODEL
  return modelPoll(out);
#else
  return false;
#endif
}

// ---------------------------------------------------------------------------
#else  // GESTURE_OFF

bool gesturesBegin(const char**) { return true; }
void gesturesStart() {}
void gesturesStop() {}
bool gesturesPoll(GestureEvent&) { return false; }

#endif
