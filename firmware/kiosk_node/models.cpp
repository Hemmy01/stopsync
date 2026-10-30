#include "models.h"

#include <stdarg.h>

#include "config.h"
#include "protocol.h"

#if VOICE_MODE == VOICE_MODEL || GESTURE_MODE == GESTURE_MODEL

// Saves ~10 KB RAM in the audio DSP, as in Edge Impulse's microphone examples.
#define EIDSP_QUANTIZE_FILTERBANK 0
// Only SDK headers read this, and this is the only file that includes them.
#define EI_CLASSIFIER_SLICES_PER_MODEL_WINDOW VOICE_SLICES_PER_WINDOW

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

// Serial hygiene: the USB serial line carries protocol lines only. The SDK's
// Arduino port writes ei_printf / ei_putchar straight to Serial through weak
// symbols; these strong definitions turn that output into "LOG,ei=<text>".
static char eiLine[80];
static size_t eiLen = 0;

static void eiFlush() {
  if (eiLen == 0) return;
  eiLine[eiLen] = '\0';
  eiLen = 0;
  sendLog("ei=%s", eiLine);
}

static void eiAppend(char c) {
  if (c == '\r') return;
  if (c == '\n') {
    eiFlush();
    return;
  }
  if (eiLen >= sizeof(eiLine) - 1) eiFlush();
  eiLine[eiLen++] = c;
}

void ei_putchar(char c) { eiAppend(c); }

void ei_printf(const char* format, ...) {
  char text[128];
  va_list args;
  va_start(args, format);
  vsnprintf(text, sizeof(text), format, args);
  va_end(args);
  for (const char* p = text; *p; p++) eiAppend(*p);
}

void ei_printf_float(float f) { ei_printf("%s", String(f, 6).c_str()); }

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
static ei_impulse_result_t voiceResult = {};

static int voiceGetData(size_t offset, size_t length, float* out) {
  return numpy::int16_to_float(&voiceSlice[offset], out, length);
}

uint32_t voiceModelSliceSize() { return VOICE_HANDLE->impulse->slice_size; }
uint32_t voiceModelFrequency() { return (uint32_t)VOICE_HANDLE->impulse->frequency; }
void voiceModelReset() { run_classifier_init(VOICE_HANDLE); }
uint32_t voiceModelSlicesPerWindow() { return VOICE_HANDLE->impulse->slices_per_model_window; }
uint16_t voiceModelLabelCount() { return VOICE_HANDLE->impulse->label_count; }
const char* voiceModelLabel(uint16_t i) { return voiceResult.classification[i].label; }
float voiceModelScore(uint16_t i) { return voiceResult.classification[i].value; }

bool voiceModelClassifySlice(const int16_t* slice, ModelScore& best) {
  voiceSlice = slice;
  signal_t signal;
  signal.total_length = VOICE_HANDLE->impulse->slice_size;
  signal.get_data = &voiceGetData;
  if (run_classifier_continuous(VOICE_HANDLE, &signal, &voiceResult, false) != EI_IMPULSE_OK) return false;
  best = bestOf(VOICE_HANDLE, voiceResult);
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
