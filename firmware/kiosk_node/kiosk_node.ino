// StopSync kiosk node: Arduino Nano 33 BLE Sense Lite.
// Listens for a voice keyword or a tap gesture after the kiosk sends START,
// and reports the chosen stop over USB serial. Protocol: docs/protocol.md.
//
//   IDLE (LED off) --START--> LISTENING (blue breathing)
//   LISTENING --confident result--> SELECT --> WAIT_ACK (route colour)
//   WAIT_ACK --ACK--> IDLE (green pulse) · --START--> LISTENING · --CANCEL--> IDLE
//   Safety timeouts: 25 s LISTENING, 30 s WAIT_ACK. One SELECT per START.

#include "config.h"
#include "gestures.h"
#include "led.h"
#include "protocol.h"
#include "voice.h"

#if VOICE_MODE == VOICE_MODEL
#define VOICE_MODE_NAME "VOICE_MODEL"
#else
#define VOICE_MODE_NAME "VOICE_OFF"
#endif

#if GESTURE_MODE == GESTURE_MODEL
#define GESTURE_MODE_NAME "GESTURE_MODEL"
#elif GESTURE_MODE == GESTURE_RULE
#define GESTURE_MODE_NAME "GESTURE_RULE"
#else
#define GESTURE_MODE_NAME "GESTURE_OFF"
#endif

enum class State { Idle, Listening, WaitAck };

static State state = State::Idle;
static uint32_t stateSince = 0;
static bool voiceOk = false;
static bool gesturesOk = false;
static const char* voiceError = nullptr;
static const char* gestureError = nullptr;

static void announce() {
  sendHello();
  sendLog("voice=%s,gesture=%s", VOICE_MODE_NAME, GESTURE_MODE_NAME);
  if (voiceError) sendLog("%s", voiceError);
  if (gestureError) sendLog("%s", gestureError);
}

static void stopSensing() {
  voiceStop();
  gesturesStop();
}

static void enterIdle() {
  state = State::Idle;
  stateSince = millis();
}

static void enterListening() {
  if (state == State::Listening) stopSensing();
  state = State::Listening;
  stateSince = millis();
  if (voiceOk) voiceStart();
  if (gesturesOk) gesturesStart();
  ledBreathe(0, 0, 255);
  sendState(true);
}

static void select(const Choice& choice, const char* method) {
  const Destination& d = DESTINATIONS[choice.destination];
  stopSensing();
  sendSelect(d.code, method, choice.confidence);
  sendState(false);
  state = State::WaitAck;
  stateSince = millis();
  ledSolid(d.r, d.g, d.b);
}

static void handleCommand(const IncomingCommand& cmd) {
  switch (cmd.type) {
    case KioskCommand::Start:
      enterListening();
      break;

    case KioskCommand::Cancel:
      if (state == State::Listening) {
        stopSensing();
        sendState(false);
      }
      ledOff();
      enterIdle();
      break;

    case KioskCommand::Ack:
      // Also valid while listening: the passenger may have tapped a tile on screen.
      if (state == State::Listening) {
        stopSensing();
        sendState(false);
      }
      ledPulse(0, 255, 0, LED_ACK_PULSE_MS);
      enterIdle();
      break;

    case KioskCommand::None:
      break;
  }
}

void setup() {
  protocolBegin();
  ledBegin();
  voiceOk = voiceBegin(&voiceError);
  gesturesOk = gesturesBegin(&gestureError);
  enterIdle();
  ledOff();
  // HELLO goes out from loop() as soon as a program opens the port.
}

void loop() {
  // A program (the kiosk page, Serial Monitor) opened the port: say hello again.
  if (protocolJustConnected()) announce();
  if (!protocolConnected() && state != State::Idle) {
    // The kiosk went away: stop rather than listen to nobody.
    if (state == State::Listening) stopSensing();
    ledOff();
    enterIdle();
  }

  IncomingCommand cmd;
  while (protocolPoll(cmd)) handleCommand(cmd);

  // Read the clock after commands: they may have just reset stateSince.
  uint32_t now = millis();

  if (state == State::Listening) {
    Choice choice;
    if (voicePoll(choice)) {
      select(choice, "voice");
    } else if (gesturesPoll(choice)) {
      select(choice, "gesture");
    } else if (now - stateSince >= LISTEN_TIMEOUT_MS) {
      stopSensing();
      sendState(false);
      sendLog("timeout=listening");
      ledOff();
      enterIdle();
    }
  } else if (state == State::WaitAck && now - stateSince >= WAIT_ACK_TIMEOUT_MS) {
    sendLog("timeout=wait_ack");
    ledOff();
    enterIdle();
  }

  ledUpdate(now);
}
