# StopSync firmware (`kiosk_node`)

Runs on the **Arduino Nano 33 BLE Sense Lite** plugged into the kiosk laptop by USB.
After the kiosk sends `START`, the board listens for a **voice keyword** or a **tap gesture**
over the proximity sensor and replies `SELECT,<code>,<voice|gesture>,<confidence>`.
Protocol: [`docs/protocol.md`](../docs/protocol.md).

| File | What it does |
|---|---|
| `kiosk_node/kiosk_node.ino` | State machine: IDLE → LISTENING → WAIT_ACK, timeouts, one SELECT per START |
| `kiosk_node/config.h` | **Every switch and tunable**: modes, model headers, destination mapping, thresholds, LED colours |
| `kiosk_node/protocol.*` | Non-blocking line reader (`START`, `ACK,<code>`, `CANCEL`) and senders |
| `kiosk_node/led.*` | Non-blocking RGB LED patterns (active LOW) |
| `kiosk_node/gestures.*` | APDS9960 proximity: rule-based taps (`GESTURE_RULE`) or the model's 20 Hz window (`GESTURE_MODEL`) |
| `kiosk_node/voice.*` | PDM microphone double buffer + consecutive-window rule (`VOICE_MODEL`) |
| `kiosk_node/models.*` | The only file that includes an Edge Impulse header (its globals must live in one `.cpp`) |
| `scripts/compile-all.sh` | Compiles every config that doesn't need the model zips, prints flash/RAM |

## Behaviour

| State | LED | Leaves on |
|---|---|---|
| IDLE | off | `START` → LISTENING |
| LISTENING | blue, breathing | confident result → sends `SELECT` + `STATE,IDLE` → WAIT_ACK · `CANCEL`/`ACK` → IDLE · 25 s → IDLE |
| WAIT_ACK | route colour (REM green, DTN purple, NYA blue, KIM yellow) | `ACK` → green pulse → IDLE · `START` → LISTENING · `CANCEL` → IDLE · 30 s → IDLE |

- When a program opens the port the board sends `HELLO,STOP-01` and `LOG,voice=<mode>,gesture=<mode>`
  (plus a `LOG` line for any sensor that failed to start).
- If the port closes while listening, the board goes idle.
- Unknown lines are answered with `LOG,ignored=<line>`.

## Build switches (`config.h`)

```cpp
#define VOICE_MODE   VOICE_OFF      // VOICE_MODEL | VOICE_OFF
#define GESTURE_MODE GESTURE_RULE   // GESTURE_MODEL | GESTURE_RULE | GESTURE_OFF
#define EI_LAYOUT    EI_SEPARATE    // EI_SEPARATE | EI_MULTI_IMPULSE
```

| Voice | Gesture | Needs |
|---|---|---|
| `VOICE_OFF` | `GESTURE_RULE` | nothing (default, works today) |
| `VOICE_MODEL` | `GESTURE_RULE` | voice zip |
| `VOICE_OFF` | `GESTURE_MODEL` | gesture zip |
| `VOICE_MODEL` | `GESTURE_MODEL` | a merged multi-impulse library (`EI_LAYOUT EI_MULTI_IMPULSE`), see option 1 |

`-D` flags override the switches without editing the file, e.g.
`--build-property "compiler.cpp.extra_flags=-DVOICE_MODE=1 -DGESTURE_MODE=1"`.

## One-time setup (macOS, zsh)

```zsh
arduino-cli core install arduino:mbed_nano       # Nano 33 BLE core (PDM comes with it)
arduino-cli lib install Arduino_APDS9960          # proximity sensor
arduino-cli config set library.enable_unsafe_install true   # allows installing Edge Impulse zips
```

## Build and upload

```zsh
arduino-cli board list                                            # find the port, e.g. /dev/cu.usbmodem1101
arduino-cli compile --fqbn arduino:mbed_nano:nano33ble firmware/kiosk_node
arduino-cli upload  --fqbn arduino:mbed_nano:nano33ble -p /dev/cu.usbmodem1101 firmware/kiosk_node
arduino-cli monitor -p /dev/cu.usbmodem1101 -c baudrate=115200    # type START, ACK,R4-001, CANCEL
```

Close the monitor (and the kiosk tab's connection) before uploading or connecting the kiosk:
only one program can open the port. If an upload can't find the board, double-tap the reset
button (the orange LED pulses) and upload again.

Check every config: `firmware/scripts/compile-all.sh`.

## Tuning the tap detector (`GESTURE_RULE`)

With `GESTURE_RULE_LOG 1` the board logs every tap (`LOG,gesture=tap,ms=180,count=1`), slow press
and group. Watch them in the kiosk debug drawer (press **D**) or `arduino-cli monitor`.

| Setting | Default | Change it when |
|---|---|---|
| `PROX_NEAR_THRESHOLD` | 150 | taps aren't noticed (lower it) or a hand passing far away counts (raise it) |
| `PROX_FAR_THRESHOLD` | 80 | one tap is counted as two (lower it, i.e. more hysteresis) |
| `TAP_MAX_MS` | 600 | quick taps logged as "slow press" (raise it) |
| `TAP_GROUP_GAP_MS` | 700 | two taps split into two groups (raise it) |
| `TAP_GROUP_CLOSE_MS` | 900 | the board answers too slowly after the last tap (lower, keep above the gap) |
| `HOLD_MS` | 1800 | holding feels too long/short |

Nearness is `255 - APDS.readProximity()`: about 0 with nothing above the sensor, up to 255
with a hand a couple of centimetres away.

## Running two Edge Impulse models

Two Edge Impulse Arduino libraries normally **clash** in one sketch: each bundles its own copy of
the SDK and defines the same `EI_CLASSIFIER_*` macros, so the build fails with duplicate symbols.
`config.h` stops this combination with an `#error` unless `EI_LAYOUT` is `EI_MULTI_IMPULSE`.
Try these options in order.

### Option 1: Edge Impulse multi-impulse (both models, one build)

Based on Edge Impulse's official guide, *Run multiple impulses (C++)*
(<https://docs.edgeimpulse.com/tutorials/topics/inference/run-multiple-impulses-cpp>). That guide
marks it a **developer preview**, targets the C++ library (a desktop Makefile example), and has no
Arduino-specific steps, so the Arduino packaging below is our adaptation.

Requirements from the guide: two **separate projects** (one per model), the **same model settings**
in both (EON compiler on in both, both int8 or both float32), no anomaly block.

1. Deploy each project as a **C++ library** (Deployment → C++ library, EON on, same quantization).
   (Automated alternative from the guide: the `multi-impulse` custom deployment block / `generate.py
   --api-keys <voice key>,<gesture key>`, which needs an Edge Impulse Organization with privileged
   mode; it produces the same merged folder.)
2. Unzip both. In each `tflite-model/`, rename `tflite_learn_<id>_compiled.cpp/.h` so the names differ
   (e.g. `..._voice` / `..._gesture`) and rename the exported functions inside to match
   (as the guide shows for `tflite_learn_<id>_init`, etc.).
3. Make a merged folder from the **voice** library (first project = its `model_metadata.h` is used;
   voice needs the audio settings), copy the gesture `tflite-model/` files into it.
4. In `model-parameters/model_variables.h`, include both model headers and merge the categories,
   impulse structs and handles of both files. Keep exactly **one** `ei_default_impulse` line.
5. Merge `tflite-model/trained_model_ops_define.h`: an `EI_TFLITE_DISABLE_...` op stays disabled
   only if it is disabled in both.
6. Package it as an Arduino library: put the merged `edge-impulse-sdk/`, `model-parameters/`,
   `tflite-model/` under `stopsync_multi_inferencing/src/`, copy `library.properties` and
   `src/<voice project>_inferencing.h` from the voice **Arduino** export, rename the header to
   `stopsync_multi_inferencing.h` and set `name=stopsync_multi_inferencing` in `library.properties`.
   Zip it into `ml/exports/stopsync_multi_inferencing.zip`.
7. Install and switch:
   ```zsh
   arduino-cli lib install --zip-path ml/exports/stopsync_multi_inferencing.zip
   ```
   In `config.h`: `VOICE_MODE VOICE_MODEL`, `GESTURE_MODE GESTURE_MODEL`, `EI_LAYOUT EI_MULTI_IMPULSE`,
   and set `VOICE_IMPULSE_HANDLE` / `GESTURE_IMPULSE_HANDLE` to the two
   `impulse_handle_<project>_<version>` names from the merged `model_variables.h`.
8. Compile, upload, and run the 10-tries test below for both inputs.

`models.cpp` already calls each model by its handle (`run_classifier_continuous(&voice, …)`,
`run_classifier(&gesture, …)`) and reads sizes from each impulse struct, so no code changes.
Watch RAM: the compile output must leave room for the voice model's arena.

### Option 2: voice model + rule-based gestures (one build, no merge)

The safe demo build. Only one Edge Impulse library is involved.

1. Install the voice zip (see "When the models arrive").
2. `config.h`: `VOICE_MODE VOICE_MODEL`, `GESTURE_MODE GESTURE_RULE`, `EI_LAYOUT EI_SEPARATE`.
3. Compile and upload. Taps still work through the rule detector (confidence 1.00).

### Option 3: two builds, one per model

Use when option 1 is too heavy and the gesture model itself must be shown.

1. Install both zips (separately they don't clash; only one is compiled per build).
2. Build A (voice): `VOICE_MODEL` + `GESTURE_RULE` (or `GESTURE_OFF`).
   Build B (gestures): `VOICE_OFF` + `GESTURE_MODEL`.
   ```zsh
   arduino-cli compile --fqbn arduino:mbed_nano:nano33ble --output-dir build/voice \
     --build-property "compiler.cpp.extra_flags=-DVOICE_MODE=1 -DGESTURE_MODE=1" firmware/kiosk_node
   arduino-cli compile --fqbn arduino:mbed_nano:nano33ble --output-dir build/gesture \
     --build-property "compiler.cpp.extra_flags=-DVOICE_MODE=0 -DGESTURE_MODE=2" firmware/kiosk_node
   ```
3. Switch during the demo in about 20 s:
   ```zsh
   arduino-cli upload --fqbn arduino:mbed_nano:nano33ble -p /dev/cu.usbmodem1101 --input-dir build/gesture
   ```
   Then press **Connect board** on the kiosk again. The boot `LOG` line shows which build is on.

## Collecting gesture data

`ml/collect/tap_logger/` prints `prox,clear` at exactly 20 Hz (same scale and order as
`gestures.cpp`). Upload it, close every serial monitor, then:

```zsh
edge-impulse-data-forwarder --frequency 20
```

Name the axes `prox,clear`. Record 3 s samples labelled `one_tap`, `two_taps`, `three_taps`,
`hold`, `passing` (hand sweeping past) and `idle` (nothing). Re-upload `kiosk_node` afterwards.
