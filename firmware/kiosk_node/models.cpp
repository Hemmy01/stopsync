#include "models.h"

#include "config.h"

#if VOICE_MODE == VOICE_MODEL || GESTURE_MODE == GESTURE_MODEL

// Saves ~10 KB RAM in the audio DSP, as in Edge Impulse's microphone examples.
#define EIDSP_QUANTIZE_FILTERBANK 0

#if EI_LAYOUT == EI_MULTI_IMPULSE
#include MULTI_MODEL_HEADER
#define VOICE_HANDLE   (&VOICE_IMPULSE_HANDLE)
#define GESTURE_HANDLE (&GESTURE_IMPULSE_HANDLE)
#elif VOICE_MODE == VOICE_MODEL
#include VOICE_MODEL_HEADER
#define VOICE_HANDLE (&ei_default_impulse)
#else
#include GESTURE_MODEL_HEADER
#define GESTURE_HANDLE (&ei_default_impulse)
#endif

static ModelScore bestOf(ei_impulse_handle_t* handle, const ei_impulse_result_t& result) {
  ModelScore best = {"", 0.0f};
  for (uint16_t i = 0; i < handle->impulse->label_count; i++) {
    if (result.classification[i].value > best.value) {
      best.label = result.classification[i].label;
      best.value = result.classification[i].value;
    }
  }
  return best;
}

#endif

// ---------------------------------------------------------------------------
#if VOICE_MODE == VOICE_MODEL

static const int16_t* voiceSlice = nullptr;

static int voiceGetData(size_t offset, size_t length, float* out) {
  return numpy::int16_to_float(&voiceSlice[offset], out, length);
}

uint32_t voiceModelSliceSize() { return VOICE_HANDLE->impulse->slice_size; }
uint32_t voiceModelFrequency() { return (uint32_t)VOICE_HANDLE->impulse->frequency; }
void voiceModelReset() { run_classifier_init(VOICE_HANDLE); }

bool voiceModelClassifySlice(const int16_t* slice, ModelScore& best) {
  voiceSlice = slice;
  signal_t signal;
  signal.total_length = VOICE_HANDLE->impulse->slice_size;
  signal.get_data = &voiceGetData;
  ei_impulse_result_t result = {};
  if (run_classifier_continuous(VOICE_HANDLE, &signal, &result, false) != EI_IMPULSE_OK) return false;
  best = bestOf(VOICE_HANDLE, result);
  return true;
}

#endif

// ---------------------------------------------------------------------------
#if GESTURE_MODE == GESTURE_MODEL

uint32_t gestureModelFeatureCount() { return GESTURE_HANDLE->impulse->dsp_input_frame_size; }

bool gestureModelClassify(float* features, ModelScore& best) {
  signal_t signal;
  if (numpy::signal_from_buffer(features, GESTURE_HANDLE->impulse->dsp_input_frame_size, &signal) != 0) {
    return false;
  }
  ei_impulse_result_t result = {};
  if (run_classifier(GESTURE_HANDLE, &signal, &result, false) != EI_IMPULSE_OK) return false;
  best = bestOf(GESTURE_HANDLE, result);
  return true;
}

#endif
