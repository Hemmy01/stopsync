# StopSync board ↔ kiosk serial protocol

How the Arduino Nano 33 BLE Sense talks to the kiosk web page.
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
  while (!Serial) {}
  Serial.println("HELLO,STOP-01");
}
```

Use `Serial.println(...)` so every message ends with a newline.
Lines longer than 512 characters are dropped.

## Board → kiosk

| Message | When to send it |
|---|---|
| `HELLO,STOP-01` | On start-up / when the serial port opens |
| `STATE,LISTENING` | The board started listening for voice or a gesture |
| `STATE,IDLE` | The board stopped listening |
| `SELECT,<code>,<method>,<confidence>` | A passenger chose a destination |

`SELECT` fields:

| Field | Allowed values |
|---|---|
| `code` | `NYA`, `REM`, `KIM`, `DTN` (exact, uppercase) |
| `method` | `voice` or `gesture` |
| `confidence` | Number from `0` to `1`, e.g. `0.91` |

Examples:

```
SELECT,KIM,voice,0.91
SELECT,DTN,gesture,0.88
```

### Destination codes

| code | Stop | Route |
|---|---|---|
| `NYA` | Nyabugogo | R1 |
| `REM` | Remera | R2 |
| `KIM` | Kimironko | R3 |
| `DTN` | Downtown | R4 |

## Kiosk → board

| Message | Meaning | What the board should do |
|---|---|---|
| `START` | A card was tapped | Start listening (send `STATE,LISTENING`) |
| `ACK,R3-014` | A queue number was created | Optional feedback (LED/beep); go idle |
| `CANCEL` | Passenger cancelled or the kiosk timed out | Stop listening (send `STATE,IDLE`) |

The kiosk may send `START` again if the passenger presses **Change** on the confirm screen.

## Rules the kiosk follows

- Unknown or malformed lines are **ignored** and shown in the kiosk's debug drawer with the reason. They never crash the page.
- `SELECT` is only accepted while the kiosk is on the **listening** step; at other times it is ignored.
- `SELECT` is only accepted for the four known destination codes.
- Listening times out after **20 s** and the confirm step after **15 s**; both send `CANCEL`.

## Typical session

```
kiosk → START
board → STATE,LISTENING
board → SELECT,KIM,voice,0.91
board → STATE,IDLE
         (passenger presses Confirm on screen)
kiosk → ACK,R3-014
```

## Testing without the kiosk

1. Open the Arduino Serial Monitor at 115200 baud with **Newline** line ending.
2. Type `START` and check that the board starts listening.
3. Close the Serial Monitor before connecting the kiosk: only one program can open the port at a time.

## Testing the kiosk without a board

Open `/kiosk?mock=1`, or press **D** on the kiosk. The debug drawer has buttons that emit every
board message, plus a field for typing raw lines. These go through exactly the same parser as real
serial input.
