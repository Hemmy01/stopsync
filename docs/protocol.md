# Tap&Select board ↔ kiosk serial protocol

How the Arduino Nano 33 BLE Sense Lite (`firmware/kiosk_node/`) talks to the kiosk web page.
The board never talks to the internet; the kiosk page (Chrome, Web Serial) is the gateway.

## Connection

| Setting | Value |
|---|---|
| Transport | USB serial (the board's native USB port) |
| Baud rate | **115200** |
| Framing | One message per line, terminated by `\n` (`\r\n` is also accepted) |
| Format | Comma-separated fields, message type in **UPPERCASE** |
| Encoding | Plain ASCII |
| USB vendor id | `0x2341` (Arduino). The kiosk offers Arduino ports first; "Any port" shows all. |

In the sketch:

```cpp
void setup() {
  Serial.begin(115200);
  uint32_t start = millis();
  while (!Serial && millis() - start < 2000) delay(10);  // never block forever
}

void loop() {
  static bool wasOpen = false;
  bool open = (bool)Serial;                 // true while a program holds the port (DTR)
  if (open && !wasOpen) Serial.println("HELLO,STOP-01");  // every time the port opens
  wasOpen = open;
}
```

Use `Serial.println(...)` so every message ends with a newline. Nothing else may be printed on this
port: library debug output (e.g. Edge Impulse's `ei_printf`) must be redirected into `LOG,` lines.
Lines longer than 512 characters are dropped.

## Board → kiosk

| Message | When to send it |
|---|---|
| `HELLO,STOP-01` | On start-up / when the serial port opens |
| `STATE,LISTENING` | The board started listening for voice or a gesture |
| `STATE,IDLE` | The board stopped listening |
| `SELECT,<code>,<method>,<confidence>` | A passenger chose a destination. **At most one per `START`.** |
| `LOG,<text>` | Diagnostics only. Shown in the debug drawer, never acted on. The text may contain commas. |

`SELECT` fields:

| Field | Allowed values |
|---|---|
| `code` | `NYA`, `REM`, `KIM`, `DTN` (exact, uppercase) |
| `method` | `voice` or `gesture` |
| `confidence` | Number from `0` to `1`, e.g. `0.91` |

Examples:

```
SELECT,KIM,voice,0.91
SELECT,DTN,gesture,1.00
LOG,voice=model,gesture=swipe,fw=0.3.0
LOG,gesture=swipe_right
```

`LOG` lines the firmware sends:

| Line | Meaning |
|---|---|
| `LOG,voice=model,gesture=swipe,fw=0.3.0` | Sent right after `HELLO`: build modes (voice `model`/`off`; gesture `swipe`/`rule`/`model`/`off`) and firmware version. The kiosk shows swipe hints for `swipe` and tap hints for `rule`/`model`. |
| `LOG,scores,downtown=0.02,kimironko=0.01,...` | Every voice label's score, once per model window while listening (only with `DEBUG_SCORES 1`). The drawer shows them as bars. |
| `LOG,voice_overrun` | The voice model fell behind the microphone (see firmware/README.md, Troubleshooting) |
| `LOG,gesture=<event>[,key=value…]` | Every gesture event while listening; the LED blinks once for each. Swipe build: `swipe_left`, `swipe_right`, `swipe_up`, `swipe_down`. Tap build: `tap,ms=180,count=1`, `one_tap`, `two_taps`, `three_taps`, `hold`, `slow_press,ms=900`, `ignored,taps=4`. The kiosk shows the latest one live ("Sensor saw ← Swipe left"). |
| `LOG,gesture=<error text>` | A gesture sensor problem at connect, e.g. `gesture=APDS9960 not found` (contains spaces, so it's never mistaken for an event) |
| `LOG,timeout=listening` · `LOG,timeout=wait_ack` | The board's safety timeouts fired |
| `LOG,ignored=<line>` | The board received a line it doesn't understand |
| `LOG,ei=<text>` | A message from the Edge Impulse SDK |

### Destination codes and how they are chosen

| code | Stop | Route | Voice label (say) | Gesture label (default) | Over the sensor | Tap label (tap build) | Tap hint | Board LED |
|---|---|---|---|---|---|---|---|---|
| `REM` | Remera | R2 | `remera` | `swipe_left` | Swipe left ← | `one_tap` | Tap once | green |
| `DTN` | Downtown | R4 | `downtown` | `swipe_right` | Swipe right → | `two_taps` | Tap twice | purple |
| `NYA` | Nyabugogo | R1 | `nyabugogo` | `swipe_up` | Swipe up ↑ | `three_taps` | Tap 3 times | blue |
| `KIM` | Kimironko | R3 | `kimironko` | `swipe_down` | Swipe down ↓ | `hold` | Hold your hand still | yellow |

Directions are as the passenger sees them; `SWIPE_SWAP_AXES` / `SWIPE_FLIP_X` / `SWIPE_FLIP_Y`
in `config.h` correct for how the board is mounted (firmware/README.md).
Labels that never select anything: voice `noise`, `unknown`; tap model `passing`, `idle`.
The mapping lives in `supabase/seed.sql` (swipe labels and hints), `apps/web/lib/destinations.ts` and
`firmware/kiosk_node/config.h` (both: swipe and tap labels); a Vitest test checks the last two agree.

## Kiosk → board

| Message | Meaning | What the board should do |
|---|---|---|
| `START` | A card was tapped, or the passenger pressed **Change** on the confirm screen | Start (or restart) listening; send `STATE,LISTENING` |
| `ACK,R3-014` | A queue number was created | Green pulse, go idle |
| `CANCEL` | Passenger cancelled, the kiosk timed out, or the card is already queued | Stop listening, go idle (send `STATE,IDLE`) |

## Rules the kiosk follows

- Unknown or malformed lines are **ignored** and shown in the kiosk's debug drawer with the reason. They never crash the page.
- `SELECT` is only accepted while the kiosk is on the **listening** step; at other times it is ignored.
- `SELECT` is only accepted for the four known destination codes.
- A `SELECT` with method `gesture` first shows the recognised gesture for 1.2 s ("→ Downtown"), then the
  confirm step. Voice and on-screen choices go straight to confirm.
- `LOG` lines are never acted on. The kiosk only reads two kinds for display: the connect line (which hints
  to show) and `gesture=<event>` (live feedback while listening).
- Listening times out after **20 s** and the confirm step after **15 s**; both send `CANCEL`.
- Every outcome of a board or on-screen choice (confirmed, changed, cancelled, timeout) is recorded
  in the `selection_events` table; the dashboard's Model insights panel reads it.

## Rules the board follows

- Safety timeouts in case the kiosk goes quiet: **25 s** listening, **30 s** waiting for `ACK`.
- After a `SELECT` the board stops listening until the next `START`.
- Voice and gesture both run while listening; the first confident result is sent.
- The gesture sensor is read on its own RTOS thread, so voice processing never delays it.
- `HELLO` (followed by the modes `LOG`) is sent every time a program opens the port, so a kiosk
  that connects late, or reconnects after an unplug, always sees it. The kiosk's status pill shows
  **Connected** only after `HELLO` arrives.

## Typical session

```
kiosk → START
board → STATE,LISTENING
board → SELECT,KIM,voice,0.91
board → STATE,IDLE
         (passenger presses Confirm on screen)
kiosk → ACK,R3-014
```

Change, then a gesture:

```
board → SELECT,KIM,voice,0.84
         (passenger presses Change)
kiosk → START
board → STATE,LISTENING
board → LOG,gesture=swipe_right
board → SELECT,DTN,gesture,1.00
board → STATE,IDLE
         (kiosk shows "→ Downtown", then the confirm step; passenger presses Confirm)
kiosk → ACK,R4-007
```

## Testing without the kiosk

1. Open the Arduino Serial Monitor at 115200 baud with **Newline** line ending.
2. Type `START` and check that the board starts listening.
3. Close the Serial Monitor before connecting the kiosk: only one program can open the port at a time.

## Testing the kiosk without a board

Open `/kiosk?mock=1`, or press **D** on the kiosk. The debug drawer has buttons that emit every
board message, plus a field for typing raw lines. These go through exactly the same parser as real
serial input.
