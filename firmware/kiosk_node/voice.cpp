#include "voice.h"

#if VOICE_MODE == VOICE_MODEL

#include <PDM.h>

#include "models.h"
#include "protocol.h"

// Double buffer, as in Edge Impulse's nano_ble33_sense_microphone_continuous example:
// the PDM callback fills one slice while loop() classifies the other.
static int16_t* slices[2] = {nullptr, nullptr};
static int16_t* pdmChunk = nullptr;
static uint32_t sliceSize = 0;
static volatile uint8_t writeIndex = 0;
static volatile uint32_t writeCount = 0;
static volatile bool sliceReady = false;
static volatile bool recording = false;
static volatile uint32_t overruns = 0;

static int lastDestination = -1;
static int streak = 0;
static bool overrunReported = false;
static uint32_t resultCount = 0;

static void onPdmData() {
  int bytes = PDM.available();
  int read = PDM.read((char*)pdmChunk, bytes);
  if (!recording) return;
  for (int i = 0; i < read / 2; i++) {
    slices[writeIndex][writeCount++] = pdmChunk[i];
    if (writeCount >= sliceSize) {
      if (sliceReady) overruns++;  // loop() fell behind; the older slice is overwritten
      writeIndex ^= 1;
      writeCount = 0;
      sliceReady = true;
    }
  }
}

bool voiceBegin(const char** error) {
  sliceSize = voiceModelSliceSize();
  slices[0] = (int16_t*)malloc(sliceSize * sizeof(int16_t));
  slices[1] = (int16_t*)malloc(sliceSize * sizeof(int16_t));
  pdmChunk = (int16_t*)malloc((sliceSize / 2) * sizeof(int16_t));
  if (!slices[0] || !slices[1] || !pdmChunk) {
    *error = "voice=no memory";
    return false;
  }
  PDM.onReceive(&onPdmData);
  PDM.setBufferSize((sliceSize / 2) * sizeof(int16_t));
  if (!PDM.begin(1, voiceModelFrequency())) {
    *error = "voice=PDM failed";
    return false;
  }
  PDM.setGain(127);
  return true;
}

void voiceStart() {
  noInterrupts();
  writeIndex = 0;
  writeCount = 0;
  sliceReady = false;
  overruns = 0;
  recording = true;
  interrupts();
  voiceModelReset();
  lastDestination = -1;
  streak = 0;
  overrunReported = false;
  resultCount = 0;
}

void voiceStop() { recording = false; }

#if DEBUG_SCORES
// "0.87" without printf float support: scores are 0..1.
static void appendScore(char* buf, size_t size, const char* label, float value) {
  int hundredths = (int)(value * 100.0f + 0.5f);
  if (hundredths < 0) hundredths = 0;
  if (hundredths > 100) hundredths = 100;
  size_t len = strlen(buf);
  snprintf(buf + len, size - len, ",%s=%d.%02d", label, hundredths / 100, hundredths % 100);
}

static void sendScores() {
  char line[128] = "scores";
  for (uint16_t i = 0; i < voiceModelLabelCount(); i++) {
    appendScore(line, sizeof(line), voiceModelLabel(i), voiceModelScore(i));
  }
  sendLog("%s", line);
}
#endif

bool voicePoll(Choice& out) {
  if (!recording) return false;
  if (overruns > 0 && !overrunReported) {
    // Classifying a slice took longer than recording one (see firmware/README.md).
    overrunReported = true;
    sendLog("voice_overrun");
  }
  if (!sliceReady) return false;
  sliceReady = false;
  const int16_t* slice = slices[writeIndex ^ 1];

  ModelScore best;
  if (!voiceModelClassifySlice(slice, best)) {
    sendLog("voice=classifier error");
    return false;
  }
  resultCount++;
#if DEBUG_SCORES
  if (resultCount % voiceModelSlicesPerWindow() == 0) sendScores();
#endif

  int destination = destinationForVoiceLabel(best.label);
  if (destination < 0 || best.value < VOICE_THRESHOLD) {
    // noise / unknown / low confidence break the streak
    lastDestination = -1;
    streak = 0;
    return false;
  }
  streak = destination == lastDestination ? streak + 1 : 1;
  lastDestination = destination;
  if (streak < VOICE_CONSECUTIVE) return false;

  out.destination = destination;
  out.confidence = best.value;
  streak = 0;
  lastDestination = -1;
  return true;
}

#else  // VOICE_OFF

bool voiceBegin(const char**) { return true; }
void voiceStart() {}
void voiceStop() {}
bool voicePoll(Choice&) { return false; }

#endif
