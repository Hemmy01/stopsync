#include "protocol.h"

#include <stdarg.h>

#include "config.h"

static const size_t LINE_MAX = 64;
static char lineBuf[LINE_MAX];
static size_t lineLen = 0;
static bool overflow = false;
static bool wasConnected = false;

void protocolBegin() {
  Serial.begin(BAUD_RATE);
  // No while (!Serial): the board must run without a host attached.
}

bool protocolConnected() { return (bool)Serial; }

bool protocolJustConnected() {
  bool now = protocolConnected();
  bool rising = now && !wasConnected;
  wasConnected = now;
  return rising;
}

static bool parseLine(const char* line, IncomingCommand& out) {
  out.type = KioskCommand::None;
  out.ackCode[0] = '\0';
  if (strcmp(line, "START") == 0) {
    out.type = KioskCommand::Start;
  } else if (strcmp(line, "CANCEL") == 0) {
    out.type = KioskCommand::Cancel;
  } else if (strncmp(line, "ACK,", 4) == 0 && line[4] != '\0') {
    out.type = KioskCommand::Ack;
    strncpy(out.ackCode, line + 4, sizeof(out.ackCode) - 1);
    out.ackCode[sizeof(out.ackCode) - 1] = '\0';
  } else {
    sendLog("ignored=%s", line);
    return false;
  }
  return true;
}

bool protocolPoll(IncomingCommand& out) {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      bool complete = !overflow && lineLen > 0;
      lineBuf[lineLen] = '\0';
      lineLen = 0;
      if (overflow) sendLog("ignored=line too long");
      overflow = false;
      if (complete && parseLine(lineBuf, out)) return true;
      continue;
    }
    if (lineLen < LINE_MAX - 1) {
      lineBuf[lineLen++] = c;
    } else {
      overflow = true;
    }
  }
  return false;
}

void sendHello() {
  Serial.print("HELLO,");
  Serial.println(STOP_ID);
}

void sendState(bool listening) { Serial.println(listening ? "STATE,LISTENING" : "STATE,IDLE"); }

void sendSelect(const char* code, const char* method, float confidence) {
  if (confidence < 0) confidence = 0;
  if (confidence > 1) confidence = 1;
  Serial.print("SELECT,");
  Serial.print(code);
  Serial.print(',');
  Serial.print(method);
  Serial.print(',');
  Serial.println(confidence, 2);
}

void sendLog(const char* fmt, ...) {
  char text[96];
  va_list args;
  va_start(args, fmt);
  vsnprintf(text, sizeof(text), fmt, args);
  va_end(args);
  Serial.print("LOG,");
  Serial.println(text);
}
