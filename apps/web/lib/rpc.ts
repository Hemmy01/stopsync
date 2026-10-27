// Typed wrappers around the Postgres functions. RPCs return jsonb, so each
// result is narrowed here instead of being trusted blindly.

import type { Json } from "./database.types";
import type { StopSyncClient } from "./supabase";

type JsonObject = { [key: string]: Json | undefined };

function asObject(value: Json | null): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function str(o: JsonObject, key: string): string | null {
  const value = o[key];
  return typeof value === "string" ? value : null;
}

function num(o: JsonObject, key: string): number | null {
  const value = o[key];
  return typeof value === "number" ? value : null;
}

export type CreateTokenResult =
  | { status: "created"; code: string; destination: string; position: number }
  | { status: "duplicate"; code: string; destination: string }
  | { status: "error"; message: string };

export function parseCreateTokenResult(data: Json | null): CreateTokenResult {
  const o = asObject(data);
  const code = o && str(o, "code");
  const destination = o && str(o, "destination");

  if (o?.status === "created" && code && destination) {
    return { status: "created", code, destination, position: num(o, "position") ?? 1 };
  }
  if (o?.status === "duplicate" && code && destination) {
    return { status: "duplicate", code, destination };
  }
  return { status: "error", message: (o && str(o, "message")) ?? "Unexpected response from the server" };
}

export interface CreateTokenArgs {
  stopId: string;
  destination: string;
  cardId: string;
  method: "voice" | "gesture" | "rfid" | "manual";
  confidence: number | null;
}

export async function createToken(
  client: StopSyncClient,
  { stopId, destination, cardId, method, confidence }: CreateTokenArgs,
): Promise<CreateTokenResult> {
  const { data, error } = await client.rpc("create_token", {
    p_stop: stopId,
    p_dest: destination,
    p_card: cardId,
    p_method: method,
    ...(confidence !== null ? { p_conf: confidence } : {}),
  });
  if (error) return { status: "error", message: error.message };
  return parseCreateTokenResult(data);
}

/** The card's current waiting ticket, if any. */
export async function findWaitingToken(
  client: StopSyncClient,
  cardId: string,
): Promise<{ code: string; destination: string } | null> {
  const { data, error } = await client
    .from("queue_tokens")
    .select("code, destination")
    .eq("card_id", cardId)
    .eq("status", "waiting")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
