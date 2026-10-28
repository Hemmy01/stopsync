# Tap&Select firmware (`kiosk_node`)

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
| `kiosk_node/voice.*` | PDM microphone double buffer + consecutive-result rule (`VOICE_MODEL`) |
| `kiosk_node/models.*` | The only file that includes an Edge Impulse header (its globals must live in one `.cpp`); also keeps the SDK's `ei_printf` off the serial line |
| `scripts/compile-all.sh` | Compiles every config (model builds once their library is installed), prints flash/RAM |

## Behaviour

| State | LED | Leaves on |
|---|---|---|
| IDLE | off | `START` → LISTENING |
| LISTENING | blue, breathing | confident result → sends `SELECT` + `STATE,IDLE` → WAIT_ACK · `CANCEL`/`ACK` → IDLE · 25 s → IDLE |
| WAIT_ACK | route colour (REM green, DTN purple, NYA blue, KIM yellow) | `ACK` → green pulse → IDLE · `START` → LISTENING · `CANCEL` → IDLE · 30 s → IDLE |

- When a program opens the port the board sends exactly `HELLO,STOP-01` then
  `LOG,voice=model,gesture=rule,fw=0.2.0` (modes `model|off` and `model|rule|off`), plus a `LOG`
  line for any sensor that failed to start. At boot it waits at most `SERIAL_WAIT_MS` (2 s) for a host.
- Voice and taps both run while LISTENING; whichever is confident first wins.
- Nothing but protocol lines reaches the serial port: Edge Impulse SDK messages (`ei_printf`) are
  turned into `LOG,ei=<text>`.
- If the port closes while listening, the board goes idle.
- Unknown lines are answered with `LOG,ignored=<line>`.

## Build switches (`config.h`)

```cpp
#define VOICE_MODE   VOICE_MODEL    // VOICE_MODEL | VOICE_OFF
#define GESTURE_MODE GESTURE_RULE   // GESTURE_MODEL | GESTURE_RULE | GESTURE_OFF
#define EI_LAYOUT    EI_SEPARATE    // EI_SEPARATE | EI_MULTI_IMPULSE
```

| Voice | Gesture | Needs |
|---|---|---|
| `VOICE_MODEL` | `GESTURE_RULE` | voice library (**default**, the demo build) |
| `VOICE_OFF` | `GESTURE_RULE` | nothing (taps only) |
| `VOICE_OFF` | `GESTURE_MODEL` | gesture zip |
| `VOICE_MODEL` | `GESTURE_MODEL` | a merged multi-impulse library (`EI_LAYOUT EI_MULTI_IMPULSE`), see option 1 |

`-D` flags override the switches without editing the file, e.g.
`--build-property "compiler.cpp.extra_flags=-DVOICE_MODE=1 -DGESTURE_MODE=1"`.

## One-time setup (macOS, zsh)

```zsh
arduino-cli core install arduino:mbed_nano       # Nano 33 BLE core (PDM comes with it)
arduino-cli lib install Arduino_APDS9960          # proximity sensor
arduino-cli config set library.enable_unsafe_install true   # allows installing Edge Impulse zips
arduino-cli lib install --zip-path "ml/exports/ei-tap-and-select-voice-arduino-1.0.1-impulse-#1.zip"
arduino-cli lib list | grep inferencing   # expect tap-and-select-voice_inferencing 1.0.1
```

Only `tap-and-select-voice_inferencing` is used. If an older Edge Impulse library such as
`Voice_recognition_inferencing` (the faucet test project) is installed, remove it so it can't be
picked by mistake: `arduino-cli lib uninstall Voice_recognition_inferencing`.

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

## Voice model (`VOICE_MODEL`)

| | |
|---|---|
| Library | `tap-and-select-voice_inferencing` 1.0.1 (Edge Impulse project 1150179), header `<tap-and-select-voice_inferencing.h>` |
| Labels | `downtown`, `kimironko`, `noise`, `nyabugogo`, `remera`, `unknown` |
| Input | 1000 ms window at 16 kHz, MFCC, int8 + EON; ~419 ms DSP + NN per window, 20.4 KB RAM, 31.3 KB flash (Edge Impulse estimate) |

Based on Edge Impulse's `nano_ble33_sense_microphone_continuous` example (PDM at 16 kHz, gain 127,
`run_classifier_continuous`, 4 slices per window = one result every 250 ms), changed so it never blocks:

- The microphone runs from boot. `loop()` checks for a full slice each pass instead of waiting
  for it, so serial commands, taps and the LED keep running.
- The classifier runs only while LISTENING. Entering LISTENING resets the continuous classifier
  (`run_classifier_init`) and the streak.
- A stop label at or above `VOICE_THRESHOLD` (0.80) for `VOICE_CONSECUTIVE` (2) results in a row
  sends `SELECT,<code>,voice,<confidence>`. `noise`, `unknown` and low scores reset the streak.
- If classifying a slice takes longer than recording one, the board sends `LOG,voice_overrun`
  (once per listening session). Fix: `VOICE_SLICES_PER_WINDOW 3` in `config.h` (see Troubleshooting).

**Tuning with `DEBUG_SCORES`.** Set `#define DEBUG_SCORES 1` in `config.h` (or add
`-DDEBUG_SCORES=1` to the compile flags) and the board sends every label's score once per window
while listening, e.g. `LOG,scores,downtown=0.02,kimironko=0.01,noise=0.03,nyabugogo=0.00,remera=0.93,unknown=0.01`.
The kiosk debug drawer (press **D**) shows these as small bars. Turn it off again for the demo.

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

## When the models arrive

Target: from zip to working kiosk in a few minutes. Do this with the kiosk tab closed.
**Voice: done** (`tap-and-select-voice_inferencing`, see "Voice model" above). These steps are now for the
gesture model and for re-exports.

### 1. Put the zips in place

Name the Edge Impulse projects (or rename the libraries) so the exports are:

| Model | Zip in `ml/exports/` | Library / header |
|---|---|---|
| Voice | `ei-tap-and-select-voice-arduino-1.0.1-impulse-#1.zip` | `tap-and-select-voice_inferencing.h` (set in `config.h`) |
| Gestures | `stopsync_gestures_inferencing.zip` (or the Edge Impulse name) | `stopsync_gestures_inferencing.h` |

If a project has another name, keep it and change `VOICE_MODEL_HEADER` / `GESTURE_MODEL_HEADER`
in `config.h` instead (the header is `src/<name>_inferencing.h` inside the zip):

```zsh
unzip -l ml/exports/<zip> | grep -m1 '_inferencing.h'
```

### 2. Check the labels before installing

```zsh
unzip -p ml/exports/stopsync_voice_inferencing.zip '*/model-parameters/model_variables.h' | grep categories
unzip -p ml/exports/stopsync_gestures_inferencing.zip '*/model-parameters/model_variables.h' | grep categories
```

Expect exactly (any order): voice `remera, nyabugogo, kimironko, downtown, noise, unknown`;
gestures `one_tap, two_taps, three_taps, hold, passing, idle`. A misspelt label never selects.
For gestures also check the window is 3000 ms at 20 Hz with 2 axes (`EI_CLASSIFIER_RAW_SAMPLE_COUNT 60`,
`EI_CLASSIFIER_RAW_SAMPLES_PER_FRAME 2`) or the board logs `gesture=model input size != 60 frames x 2`.

### 3. Install

```zsh
arduino-cli config set library.enable_unsafe_install true     # once
arduino-cli lib install --zip-path ml/exports/stopsync_voice_inferencing.zip
arduino-cli lib install --zip-path ml/exports/stopsync_gestures_inferencing.zip
arduino-cli lib list | grep inferencing
```

Re-exported a model? Install the new zip the same way; it replaces the old version.

### 4. Flip the switches (`config.h`)

| Have | Set |
|---|---|
| Voice only | `VOICE_MODE VOICE_MODEL`, `GESTURE_MODE GESTURE_RULE` (option 2) |
| Gestures only | `VOICE_MODE VOICE_OFF`, `GESTURE_MODE GESTURE_MODEL` |
| Both | option 1 (merged library) or option 3 (two builds) above |

### 5. Compile, upload, confirm

```zsh
firmware/scripts/compile-all.sh          # model configs stop being SKIP once installed
arduino-cli compile --fqbn arduino:mbed_nano:nano33ble firmware/kiosk_node
arduino-cli upload  --fqbn arduino:mbed_nano:nano33ble -p /dev/cu.usbmodem1101 firmware/kiosk_node
arduino-cli monitor -p /dev/cu.usbmodem1101 -c baudrate=115200
```

The first lines must read `HELLO,STOP-01` and `LOG,voice=model,gesture=...,fw=...` with no error `LOG`.
Type `START` and say a stop: expect `SELECT,REM,voice,0.9x` then `STATE,IDLE`. Close the monitor.

### 6. Test each stop 10 times on the board

Open the kiosk, **Connect board**, press **D** for the drawer. For each stop and each input:
tap a demo card, say the name (or do the gesture) once, note the result, press **Change** to retry.

| Stop | Say | Gesture | Voice hits /10 | Gesture hits /10 |
|---|---|---|---|---|
| REM | "Remera" | Tap once | | |
| DTN | "Downtown" | Tap twice | | |
| NYA | "Nyabugogo" | Tap 3 times | | |
| KIM | "Kimironko" | Hold your hand still | | |

Also try 10 × background talking and 10 × a hand passing: nothing should select.
Record the results in `ml/results/voice.md` and `ml/results/gestures.md`, then update
`apps/web/content/models.json` (status `on_board`, test accuracy, date) so the dashboard and `/about` show them.

### 7. Tune the thresholds

| Symptom | Change |
|---|---|
| Right stop, but slow / needs repeating | lower `VOICE_THRESHOLD` / `GESTURE_THRESHOLD` (e.g. 0.80 → 0.70) or the `*_CONSECUTIVE` count to 1 |
| Wrong stop or false selects from noise | raise the threshold (0.85–0.90) or keep `*_CONSECUTIVE` at 2–3 |
| One stop always weak | collect more samples for that label and retrain; check the confusion matrix |

The confidence in every `SELECT` is shown on the kiosk confirm screen and stored in
`selection_events`; the dashboard's Model insights shows average confidence and how often
passengers press Change per method.

## Testing the voice build with the kiosk

1. Close everything that uses the port (Serial Monitor, `arduino-cli monitor`, other kiosk tabs), then upload:
   `arduino-cli upload --fqbn arduino:mbed_nano:nano33ble -p /dev/cu.usbmodem1101 firmware/kiosk_node`
2. Open `/kiosk` (`http://localhost:3000/kiosk` or the Vercel `https://` URL; Web Serial needs one of the two)
   in Chrome or Edge, click **Connect board**, choose the Arduino.
3. Press **D**: the drawer shows `HELLO,STOP-01` and `LOG,voice=model,gesture=rule,fw=0.2.0`; the pill says **Connected**.
4. Tap a demo card → LED blue breathing → say "Remera" from 30–50 cm → *Remera?* · *Heard by voice · 9x%*
   → **Confirm** → ticket → LED green pulse.
5. Repeat for Nyabugogo, Kimironko, Downtown. Then say other words, and stay silent for 20 s:
   nothing may be selected.
6. Tap twice over the sensor → *Downtown?* · *Gesture · 100%*.
7. Unplug and replug the board: the kiosk reconnects by itself and the pill returns to **Connected**.

## Troubleshooting

| Problem | Fix |
|---|---|
| Upload or **Connect board** says the port is busy | Close the Serial Monitor, `arduino-cli monitor` and other kiosk tabs (only one program can open the port), then retry. Upload still failing: double-tap reset (orange LED pulses). |
| `fatal error: tap-and-select-voice_inferencing.h: No such file` | Install the zip (One-time setup). Check with `arduino-cli lib list \| grep inferencing`. |
| Wrong labels / faucet model behaviour | An old library is being used. `arduino-cli lib uninstall Voice_recognition_inferencing`; check `VOICE_MODEL_HEADER` in `config.h`. The compile output's "Used library" lines show which one was linked. |
| `LOG,voice_overrun` | Classifying a slice took longer than recording it (250 ms). Set `VOICE_SLICES_PER_WINDOW 3` in `config.h` (one result every ~333 ms), recompile, retest. It overrides the library's `EI_CLASSIFIER_SLICES_PER_MODEL_WINDOW`; the library itself stays untouched. |
| Pill stays **Not connected** after choosing the port | The board didn't send `HELLO`: replug it, or re-upload; check the drawer for any line at all. |
| `LOG,ei=...` lines | Messages from the Edge Impulse SDK (normally only on errors), passed through as diagnostics. |
| Voice never selects | Turn on `DEBUG_SCORES` and watch the scores while speaking; lower `VOICE_THRESHOLD` or set `VOICE_CONSECUTIVE 1` (step 7 above). |
