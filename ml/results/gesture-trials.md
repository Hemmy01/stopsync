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

<!-- gesture-trials.mjs appends below this line -->

