# Edge Impulse exports

**Arduino library** zips from Edge Impulse (Deployment → Arduino library).

| File | Library / header | Labels |
|---|---|---|
| `ei-tap-and-select-voice-arduino-1.0.1-impulse-#1.zip` | `tap-and-select-voice_inferencing` · `<tap-and-select-voice_inferencing.h>` (project 1150179, deploy v1) | downtown, kimironko, noise, nyabugogo, remera, unknown |
| gesture model (later) | set `GESTURE_MODEL_HEADER` in `firmware/kiosk_node/config.h` | one_tap, two_taps, three_taps, hold, passing, idle |

Install (quote the path, it contains `#`):

```zsh
arduino-cli lib install --zip-path "ml/exports/ei-tap-and-select-voice-arduino-1.0.1-impulse-#1.zip"
```

Switch on and test: see "When the models arrive" in `firmware/README.md`.
