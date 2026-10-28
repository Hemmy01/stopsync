// Thin wrapper over the Edge Impulse SDK. models.cpp is the only file that
// includes an Edge Impulse header (its globals must exist in one translation
// unit), so voice.cpp and gestures.cpp talk to the models through this API.
#pragma once

#include <Arduino.h>

struct ModelScore {
  const char* label;  // highest-scoring label
  float value;        // its score, 0..1
};

// Voice impulse (continuous audio). Only available with VOICE_MODE == VOICE_MODEL.
uint32_t voiceModelSliceSize();   // samples per slice
uint32_t voiceModelFrequency();   // Hz
void voiceModelReset();           // reset continuous state (call when listening starts)
// Classify one slice of 16-bit audio; false on SDK error.
bool voiceModelClassifySlice(const int16_t* slice, ModelScore& best);
uint32_t voiceModelSlicesPerWindow();  // results per full model window
// Every label's score from the latest voice result (DEBUG_SCORES).
uint16_t voiceModelLabelCount();
const char* voiceModelLabel(uint16_t i);
float voiceModelScore(uint16_t i);

// Gesture impulse. Only available with GESTURE_MODE == GESTURE_MODEL.
uint32_t gestureModelFeatureCount();  // must equal GESTURE_WINDOW_FRAMES * GESTURE_AXES
// features: frames oldest first, each frame "prox, clear".
bool gestureModelClassify(float* features, ModelScore& best);
