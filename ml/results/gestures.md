# Tap-gesture model results

Edge Impulse project: _name / link_ · Export version: _v?_ · Date: _YYYY-MM-DD_

Data collected with `ml/collect/tap_logger` + `edge-impulse-data-forwarder --frequency 20`,
axes `prox,clear` (nearness 0..255, clear count).

## Dataset

| Label | Samples (3 s) | People |
|---|---|---|
| one_tap | | |
| two_taps | | |
| three_taps | | |
| hold | | |
| passing | | |
| idle | | |

Train / test split: _80 / 20_

## Impulse settings

| Setting | Value |
|---|---|
| Window size / increase | 3000 ms / _ms_ |
| Frequency | 20 Hz, 2 axes (60 × 2 = 120 values) |
| Processing block | _Raw data / Flatten / Spectral analysis_ (params: _…_) |
| Learning block | _Classifier NN_, _layers_, _epochs_ |
| Quantization / EON | _int8_ / _on_ |
| On-device estimate | _latency ms_, _RAM KB_, _flash KB_ |

## Accuracy

| | Value |
|---|---|
| Validation accuracy | |
| Test accuracy | |
| Confusion matrix | `ml/results/gestures-confusion.png` |

## On the board (10 tries each, firmware/README.md step 6)

| Stop | Gesture | Hits /10 | Avg confidence | Notes |
|---|---|---|---|---|
| REM | Tap once | | | |
| DTN | Tap twice | | | |
| NYA | Tap 3 times | | | |
| KIM | Hold your hand still | | | |
| (none) | hand passing | false selects: | | |

Rule-based baseline (`GESTURE_RULE`, same test): REM _/10_ · DTN _/10_ · NYA _/10_ · KIM _/10_

## Thresholds used

`GESTURE_THRESHOLD` = 0.80 · `GESTURE_CONSECUTIVE` = 2 · _why changed, if changed_
