// Voice keyword spotting (Edge Impulse, continuous microphone). Only infers
// while listening. With VOICE_OFF every call is a no-op.
#pragma once

#include "config.h"

// Allocates buffers and starts the microphone. false (with a reason) on failure.
bool voiceBegin(const char** error);
void voiceStart();
void voiceStop();
// Call every loop while listening: true when one stop label stayed at or above
// VOICE_THRESHOLD for VOICE_CONSECUTIVE windows.
bool voicePoll(Choice& out);
