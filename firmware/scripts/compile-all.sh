#!/usr/bin/env bash
# Compile every kiosk_node configuration (model builds only when the model
# library is installed) plus tap_logger, and report flash/RAM. Usage: firmware/scripts/compile-all.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
FQBN=arduino:mbed_nano:nano33ble
BUILD="${TMPDIR:-/tmp}/stopsync-fw-build"
fail=0

build() { # name, sketch dir, extra flags
  local name=$1 dir=$2 flags=${3:-}
  local out
  if out=$(arduino-cli compile --fqbn "$FQBN" --build-path "$BUILD/$name" \
      ${flags:+--build-property "compiler.cpp.extra_flags=$flags"} "$dir" 2>&1); then
    local flash ram
    flash=$(grep -o 'Sketch uses [0-9]* bytes ([0-9]*%)' <<<"$out" | sed 's/Sketch uses //')
    ram=$(grep -o 'Global variables use [0-9]* bytes ([0-9]*%)' <<<"$out" | sed 's/Global variables use //')
    printf 'PASS  %-36s flash %-22s RAM %s\n' "$name" "$flash" "$ram"
  else
    printf 'FAIL  %s\n' "$name"; grep -E 'error' <<<"$out" | head -5; fail=1
  fi
}

build "voice_off+gesture_rule" firmware/kiosk_node "-DVOICE_MODE=0 -DGESTURE_MODE=1"
build "voice_off+gesture_off"  firmware/kiosk_node "-DVOICE_MODE=0 -DGESTURE_MODE=0"
build "tap_logger"             ml/collect/tap_logger

# Model configs compile once their library is installed (see firmware/README.md).
VOICE_LIB=tap-and-select-voice_inferencing   # ml/exports/ei-tap-and-select-voice-*.zip
GESTURE_LIB=""                               # set when the gesture model is exported
installed() { [ -n "$1" ] && arduino-cli lib list 2>/dev/null | grep -q "^$1 "; }

if installed "$VOICE_LIB"; then
  build "voice_model+gesture_rule (default)" firmware/kiosk_node "-DVOICE_MODE=1 -DGESTURE_MODE=1"
  build "voice_model+debug_scores+3_slices"  firmware/kiosk_node "-DVOICE_MODE=1 -DGESTURE_MODE=1 -DDEBUG_SCORES=1 -DVOICE_SLICES_PER_WINDOW=3"
else
  printf 'SKIP  %-36s (%s not installed)\n' "voice model" "$VOICE_LIB"
fi
if installed "$GESTURE_LIB"; then
  build "voice_off+gesture_model" firmware/kiosk_node "-DVOICE_MODE=0 -DGESTURE_MODE=2 -DGESTURE_MODEL_HEADER=<${GESTURE_LIB}.h>"
else
  printf 'SKIP  %-36s (no gesture library yet)\n' "gesture model"
fi
exit $fail
