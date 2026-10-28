# Voice model results

Edge Impulse project: _name / link_ · Export version: _v?_ · Date: _YYYY-MM-DD_

## Dataset

| Label | Samples | Total length | Speakers |
|---|---|---|---|
| remera | | | |
| nyabugogo | | | |
| kimironko | | | |
| downtown | | | |
| noise | | | |
| unknown | | | |

Train / test split: _80 / 20_

## Impulse settings

| Setting | Value |
|---|---|
| Window size / increase | 1000 ms / _ms_ |
| Frequency | 16000 Hz |
| Processing block | _MFCC / MFE_ (params: _…_) |
| Learning block | _Keyword spotting NN_, _epochs_, _learning rate_ |
| Quantization / EON | _int8_ / _on_ |
| On-device estimate | _latency ms_, _RAM KB_, _flash KB_ |

## Accuracy

| | Value |
|---|---|
| Validation accuracy | |
| Test accuracy | |
| Confusion matrix | `ml/results/voice-confusion.png` |

## On the board (10 tries each, firmware/README.md step 6)

| Stop | Said | Hits /10 | Avg confidence | Notes |
|---|---|---|---|---|
| REM | "Remera" | | | |
| DTN | "Downtown" | | | |
| NYA | "Nyabugogo" | | | |
| KIM | "Kimironko" | | | |
| (none) | background talk | false selects: | | |

## Thresholds used

`VOICE_THRESHOLD` = 0.80 · `VOICE_CONSECUTIVE` = 2 · _why changed, if changed_
