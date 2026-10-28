// Model status shown on the dashboard and /about. Edit content/models.json
// after each export (firmware/README.md, "When the models arrive").

import raw from "@/content/models.json";

export type ModelStatus = "pending" | "training" | "trained" | "rule" | "on_board";

export interface ModelInfo {
  status: ModelStatus;
  /** 0–1 from Edge Impulse's test set; null until known. */
  testAccuracy: number | null;
  /** 0–1 from Edge Impulse's validation set (training page); null until known. */
  validationAccuracy: number | null;
  labels: string[];
  /** ISO date of the last export. */
  updated: string | null;
}

export type ModelKey = "voice" | "gesture";

export const MODELS = raw as Record<ModelKey, ModelInfo>;

export const MODEL_STATUS_LABEL: Record<ModelStatus, string> = {
  pending: "Not trained yet",
  training: "Training",
  trained: "Trained, in the firmware",
  rule: "Rule-based (model pending)",
  on_board: "On the board",
};

export function formatAccuracy(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/** The accuracy to show: test set if known, else validation, labelled as such. */
export function headlineAccuracy(info: ModelInfo): { kind: "test" | "validation"; value: number | null } {
  if (info.testAccuracy !== null || info.validationAccuracy === null) return { kind: "test", value: info.testAccuracy };
  return { kind: "validation", value: info.validationAccuracy };
}
