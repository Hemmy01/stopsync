# Gesture trials: tap rules (before) vs swipes (after)

Judges' feedback: tap counting was unreliable and only "hold" (Kimironko) worked well. Firmware 0.3.0
reads the APDS9960 on its own RTOS thread and adds swipes (the sensor's direction engine) as the
default. This file holds the measured before/after results. `firmware/scripts/gesture-trials.mjs`
appends a table here after every run.

## How to run (about 15 minutes per run)

Same person, same spot (arm's length, hand 3–10 cm above the sensor), same lighting for both runs.
Close the kiosk tab and every serial monitor first: only one program can open the port.

```zsh
arduino-cli board list          # find the port, e.g. /dev/cu.usbmodem1101
```

**Before: firmware 0.2.0, tap rules** (the code on `main` before this change):

```zsh
git worktree add ../tas-before main          # a copy of the old code next to this repo
arduino-cli compile --fqbn arduino:mbed_nano:nano33ble ../tas-before/firmware/kiosk_node
arduino-cli upload  --fqbn arduino:mbed_nano:nano33ble -p /dev/cu.usbmodem1101 ../tas-before/firmware/kiosk_node
node firmware/scripts/gesture-trials.mjs --port /dev/cu.usbmodem1101 --label before
git worktree remove ../tas-before
```

The script reads the stop list from this branch's `config.h` and the gesture mode from the board,
so it shows tap instructions for the old firmware.

**After: firmware 0.3.0, swipes** (this branch, default `config.h`):

```zsh
arduino-cli compile --fqbn arduino:mbed_nano:nano33ble firmware/kiosk_node
arduino-cli upload  --fqbn arduino:mbed_nano:nano33ble -p /dev/cu.usbmodem1101 firmware/kiosk_node
node firmware/scripts/gesture-trials.mjs --port /dev/cu.usbmodem1101 --label after
```

Optional third run, the tap rules on the new sensor thread (shows how much the thread alone helped):

```zsh
arduino-cli compile --fqbn arduino:mbed_nano:nano33ble \
  --build-property "compiler.cpp.extra_flags=-DGESTURE_MODE=1" firmware/kiosk_node
arduino-cli upload  --fqbn arduino:mbed_nano:nano33ble -p /dev/cu.usbmodem1101 firmware/kiosk_node
node firmware/scripts/gesture-trials.mjs --port /dev/cu.usbmodem1101 --label "after (taps, threaded)"
```

What the script does: for each stop it waits for Enter, then runs 20 tries. Each try sends `START`, prints
**GO**, waits up to 8 s for a `SELECT`, then sends `CANCEL`. Do the gesture once per GO. A final control
block (20 × 5 s, do nothing) counts false selects. Every `LOG,gesture=…` event is printed next to the
result, so you can see why a try failed (e.g. `tap,count=1 tap,count=1` = two taps split into two groups).

Voice runs too on the default build: keep the room quiet, or the script warns you. Options:
`--tries 20` · `--timeout 8` · `--only REM,DTN` · `--no-control` · `--out <file>`.

Before the "after" run, check the orientation: swipe left once in the kiosk debug drawer or
`arduino-cli monitor` and look for `LOG,gesture=swipe_left`. If it reads otherwise, set the
`SWIPE_*` flags in `config.h` (firmware/README.md, "Swipes").

## Reading the table

| Column | Meaning |
|---|---|
| Correct | `SELECT` with the expected stop and method `gesture` |
| Wrong stop | a `SELECT` for another stop, or by voice |
| Missed | nothing selected before the timeout |
| Median time | from `STATE,LISTENING` to `SELECT`, correct tries only (includes doing the gesture) |
| Control row | "Correct" = tries where nothing was selected |

Target for the demo: every gesture ≥ 18/20 (90%) and 0 false selects in the control block.

## Results

### Summary (2026-10-29, same person, board in its demo mounting)

| | Before: fw 0.2.0 tap rules | After: fw 0.3.1 swipes |
|---|---|---|
| Remera | Tap once 16/20 (80%) | ← Swipe left 19/20 (95%) |
| Downtown | Tap twice **0/20** (read as hold) | → Swipe right 19/20 (95%) |
| Nyabugogo | Tap 3 times **0/20** (read as hold) | ↑ Swipe up 17/20 (85%) |
| Kimironko | Hold 15/20 (75%) | ↓ Swipe down 18/20 (90%) |
| **All four** | **31/80 (39%)** | **73/80 (91%)** |
| Wrong stop selected | 21 | 2 |
| Do nothing: false selects | 0/20 | 0/20 |

Getting there took two fixes found during testing: the Arduino_APDS9960 library's own direction
decoder reports any sideways swipe with vertical wobble as up/down (we decode the FIFO ourselves),
and the board needed `SWIPE_SWAP_AXES 1` + `SWIPE_FLIP_X 1` for its mounting. Swipe up is the one
below the 90% target: swipe straight, not on an arc.

<!-- gesture-trials.mjs appends below this line -->

### after (fw 0.3.1 swipes) · 2026-10-29 · fw 0.3.1 · gesture=swipe

`voice=model,gesture=swipe,fw=0.3.1` · 20 tries each · 8 s timeout

| Gesture → stop | Correct | Wrong stop | Missed | Hit rate | Median time |
|---|---|---|---|---|---|
| ← Swipe left → REM | 19/20 | — | 1 | 95% | 1023 ms |
| → Swipe right → DTN | 19/20 | — | 1 | 95% | 617 ms |
| ↑ Swipe up → NYA | 17/20 | KIM/gesture | 2 | 85% | 2286 ms |
| ↓ Swipe down → KIM | 18/20 | NYA/gesture | 1 | 90% | 651 ms |
| Do nothing → (none) | 20/20 | — | 0 | 100% | — |

### before (fw 0.2.0 tap rules) · 2026-10-29 · fw 0.2.0 · gesture=rule

`voice=model,gesture=rule,fw=0.2.0` · 20 tries each · 8 s timeout

| Gesture → stop | Correct | Wrong stop | Missed | Hit rate | Median time |
|---|---|---|---|---|---|
| Tap once → REM | 16/20 | DTN/gesture, DTN/gesture | 2 | 80% | 1998 ms |
| Tap twice → DTN | 0/20 | KIM/gesture, KIM/gesture, KIM/gesture | 17 | 0% | — |
| Tap 3 times → NYA | 0/20 | KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture, KIM/gesture | 4 | 0% | — |
| Hold your hand still → KIM | 15/20 | — | 5 | 75% | 2589 ms |
| Do nothing → (none) | 20/20 | — | 0 | 100% | — |

