#include "gestures.h"

#if GESTURE_MODE != GESTURE_OFF

#include <Arduino_APDS9960.h>

#include "protocol.h"

static bool active = false;
static int nearness = 0;    // latest proximity, 0..255, higher = closer
static int clearLevel = 0;  // latest clear-channel reading (model only)

static void readSensor() {
  if (APDS.proximityAvailable()) nearness = proximityToNearness(APDS.readProximity());
#if GESTURE_MODE == GESTURE_MODEL
  if (APDS.colorAvailable()) {
    int r, g, b, c;
    APDS.readColor(r, g, b, c);
    clearLevel = c;
  }
#endif
}

static bool choose(const char* label, float confidence, Choice& out) {
  int destination = destinationForGestureLabel(label);
  if (destination < 0) return false;  // passing / idle / unknown
  out.destination = destination;
  out.confidence = confidence;
  return true;
}

#endif

// ---------------------------------------------------------------------------
#if GESTURE_MODE == GESTURE_RULE

enum class Hand { Away, Near };

static Hand hand = Hand::Away;
static uint32_t nearSince = 0;
static uint32_t lastTapEnd = 0;
static int taps = 0;
static bool holdFired = false;
static bool waitForAway = false;  // hand was already near when listening started

static bool closeGroup(Choice& out) {
  static const char* const LABELS[] = {"", "one_tap", "two_taps", "three_taps"};
  int count = taps;
  taps = 0;
  if (count < 1 || count > 3) {
#if GESTURE_RULE_LOG
    sendLog("gesture=ignored,taps=%d", count);
#endif
    return false;
  }
#if GESTURE_RULE_LOG
  sendLog("gesture=%s", LABELS[count]);
#endif
  return choose(LABELS[count], 1.0f, out);
}

bool gesturesBegin(const char** error) {
  if (!APDS.begin()) {
    *error = "gesture=APDS9960 not found";
    return false;
  }
  return true;
}

void gesturesStart() {
  readSensor();
  hand = nearness >= PROX_NEAR_THRESHOLD ? Hand::Near : Hand::Away;
  waitForAway = hand == Hand::Near;
  taps = 0;
  holdFired = false;
  active = true;
}

void gesturesStop() { active = false; }

bool gesturesPoll(Choice& out) {
  if (!active) return false;
  readSensor();
  uint32_t now = millis();

  if (hand == Hand::Away && nearness >= PROX_NEAR_THRESHOLD) {
    hand = Hand::Near;
    nearSince = now;
    // A new press long after the last tap: the previous group is finished.
    if (taps > 0 && now - lastTapEnd >= TAP_GROUP_GAP_MS) return closeGroup(out);
  } else if (hand == Hand::Near && nearness <= PROX_FAR_THRESHOLD) {
    hand = Hand::Away;
    uint32_t held = now - nearSince;
    if (waitForAway || holdFired) {
      waitForAway = false;
      holdFired = false;
    } else if (held <= TAP_MAX_MS) {
      taps++;
      lastTapEnd = now;
#if GESTURE_RULE_LOG
      sendLog("gesture=tap,ms=%lu,count=%d", (unsigned long)held, taps);
#endif
    } else {
#if GESTURE_RULE_LOG
      sendLog("gesture=slow press ignored,ms=%lu", (unsigned long)held);
#endif
      taps = 0;
    }
  } else if (hand == Hand::Near && !waitForAway && !holdFired && now - nearSince >= HOLD_MS) {
    holdFired = true;
    taps = 0;
#if GESTURE_RULE_LOG
    sendLog("gesture=hold");
#endif
    return choose("hold", 1.0f, out);
  }

  if (hand == Hand::Away && taps > 0 && now - lastTapEnd >= TAP_GROUP_CLOSE_MS) return closeGroup(out);
  return false;
}

// ---------------------------------------------------------------------------
#elif GESTURE_MODE == GESTURE_MODEL

#include "models.h"

static const uint32_t SAMPLE_PERIOD_US = 1000000UL / GESTURE_SAMPLE_HZ;
static const int FEATURES = GESTURE_WINDOW_FRAMES * GESTURE_AXES;

static float ring[FEATURES];  // frame i at ring[i*2], ring[i*2+1]
static float features[FEATURES];
static int head = 0;    // next frame slot
static int filled = 0;  // frames since start / last clear
static uint32_t nextSampleUs = 0;
static uint32_t lastClassifyMs = 0;
static int lastDestination = -1;
static int streak = 0;

bool gesturesBegin(const char** error) {
  if (!APDS.begin()) {
    *error = "gesture=APDS9960 not found";
    return false;
  }
  if (gestureModelFeatureCount() != (uint32_t)FEATURES) {
    *error = "gesture=model input size != 60 frames x 2";
    return false;
  }
  return true;
}

static void clearWindow() {
  head = 0;
  filled = 0;
  lastDestination = -1;
  streak = 0;
}

void gesturesStart() {
  clearWindow();
  nextSampleUs = micros();
  lastClassifyMs = millis();
  active = true;
}

void gesturesStop() { active = false; }

bool gesturesPoll(Choice& out) {
  if (!active) return false;
  readSensor();

  // Exactly GESTURE_SAMPLE_HZ frames per second, like tap_logger.
  uint32_t nowUs = micros();
  if ((int32_t)(nowUs - nextSampleUs) >= 0) {
    ring[head * 2] = (float)nearness;
    ring[head * 2 + 1] = (float)clearLevel;
    head = (head + 1) % GESTURE_WINDOW_FRAMES;
    if (filled < GESTURE_WINDOW_FRAMES) filled++;
    nextSampleUs += SAMPLE_PERIOD_US;
    // Fell far behind (e.g. a long inference): resync instead of bursting.
    if ((int32_t)(nowUs - nextSampleUs) > (int32_t)SAMPLE_PERIOD_US) nextSampleUs = nowUs + SAMPLE_PERIOD_US;
  }

  uint32_t nowMs = millis();
  if (filled < GESTURE_WINDOW_FRAMES || nowMs - lastClassifyMs < GESTURE_CLASSIFY_MS) return false;
  lastClassifyMs = nowMs;

  // Oldest frame first.
  for (int i = 0; i < GESTURE_WINDOW_FRAMES; i++) {
    int frame = (head + i) % GESTURE_WINDOW_FRAMES;
    features[i * 2] = ring[frame * 2];
    features[i * 2 + 1] = ring[frame * 2 + 1];
  }

  ModelScore best;
  if (!gestureModelClassify(features, best)) {
    sendLog("gesture=classifier error");
    return false;
  }

  int destination = destinationForGestureLabel(best.label);
  if (destination < 0 || best.value < GESTURE_THRESHOLD) {
    lastDestination = -1;
    streak = 0;
    return false;
  }
  streak = destination == lastDestination ? streak + 1 : 1;
  lastDestination = destination;
  if (streak < GESTURE_CONSECUTIVE) return false;

  float confidence = best.value;
  clearWindow();  // never re-detect the same movement
  return choose(best.label, confidence, out);
}

// ---------------------------------------------------------------------------
#else  // GESTURE_OFF

bool gesturesBegin(const char**) { return true; }
void gesturesStart() {}
void gesturesStop() {}
bool gesturesPoll(Choice&) { return false; }

#endif
