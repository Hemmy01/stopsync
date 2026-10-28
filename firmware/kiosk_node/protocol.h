// Line-based serial protocol with the kiosk page. See docs/protocol.md.
#pragma once

#include <Arduino.h>

enum class KioskCommand { None, Start, Ack, Cancel };

struct IncomingCommand {
  KioskCommand type;
  char ackCode[16];  // only for Ack, e.g. "R3-014"
};

void protocolBegin();
// Non-blocking: reads what is available; true when a full command line arrived.
bool protocolPoll(IncomingCommand& out);
// True on the transition to "a program opened the port" (DTR raised).
bool protocolJustConnected();
bool protocolConnected();

void sendHello();
void sendState(bool listening);
void sendSelect(const char* code, const char* method, float confidence);
void sendLog(const char* fmt, ...);
