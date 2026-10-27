import { describe, expect, it } from "vitest";
import {
  DESTINATIONS,
  NON_SELECTING_GESTURE_LABELS,
  NON_SELECTING_VOICE_LABELS,
} from "@/lib/destinations";
import { formatAccuracy, MODEL_STATUS_LABEL, MODELS } from "@/lib/models";

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
      if (model.testAccuracy !== null) {
        expect(model.testAccuracy).toBeGreaterThanOrEqual(0);
        expect(model.testAccuracy).toBeLessThanOrEqual(1);
      }
    }
  });

  it("formats accuracy", () => {
    expect(formatAccuracy(null)).toBe("—");
    expect(formatAccuracy(0.934)).toBe("93%");
  });
});
