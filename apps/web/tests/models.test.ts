import { describe, expect, it } from "vitest";
import {
  DESTINATIONS,
  NON_SELECTING_GESTURE_LABELS,
  NON_SELECTING_VOICE_LABELS,
} from "@/lib/destinations";
import { formatAccuracy, headlineAccuracy, MODEL_STATUS_LABEL, MODELS, type ModelInfo } from "@/lib/models";

const sorted = (xs: readonly string[]) => [...xs].sort();

describe("content/models.json", () => {
  it("lists exactly the voice labels the firmware expects", () => {
    expect(sorted(MODELS.voice.labels)).toEqual(
      sorted([...DESTINATIONS.map((d) => d.voiceLabel), ...NON_SELECTING_VOICE_LABELS]),
    );
  });

  it("lists exactly the gesture labels the firmware expects", () => {
    expect(sorted(MODELS.gesture.labels)).toEqual(
      sorted([...DESTINATIONS.map((d) => d.gestureLabel), ...NON_SELECTING_GESTURE_LABELS]),
    );
  });

  it("has a known status and a valid accuracy", () => {
    for (const model of Object.values(MODELS)) {
      expect(Object.keys(MODEL_STATUS_LABEL)).toContain(model.status);
      for (const value of [model.testAccuracy, model.validationAccuracy]) {
        if (value === null) continue;
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("shows test accuracy first, else validation, labelled as such", () => {
    const base: ModelInfo = { status: "trained", testAccuracy: null, validationAccuracy: null, labels: [], updated: null };
    expect(headlineAccuracy(base)).toEqual({ kind: "test", value: null });
    expect(headlineAccuracy({ ...base, validationAccuracy: 0.91 })).toEqual({ kind: "validation", value: 0.91 });
    expect(headlineAccuracy({ ...base, testAccuracy: 0.88, validationAccuracy: 0.91 })).toEqual({ kind: "test", value: 0.88 });
  });

  it("formats accuracy", () => {
    expect(formatAccuracy(null)).toBe("—");
    expect(formatAccuracy(0.934)).toBe("93%");
  });
});
