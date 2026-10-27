// Model status shown on the dashboard and /about. Edit content/models.json
// after each export (firmware/README.md, "When the models arrive").

import raw from "@/content/models.json";

export type ModelStatus = "pending" | "training" | "rule" | "on_board";

export interface ModelInfo {
  status: ModelStatus;
  /** 0–1 from Edge Impulse's test set; null until known. */
  testAccuracy: number | null;
  labels: string[];
  /** ISO date of the last export. */
  updated: string | null;
}

export type ModelKey = "voice" | "gesture";

export const MODELS = raw as Record<ModelKey, ModelInfo>;

export const MODEL_STATUS_LABEL: Record<ModelStatus, string> = {
  pending: "Not trained yet",
  training: "Training",
  rule: "Rule-based (model pending)",
  on_board: "On the board",
};

export function formatAccuracy(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}
