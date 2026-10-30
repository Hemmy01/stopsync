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

export type CancelTokenResult =
  | { status: "cancelled"; code: string }
  | { status: "error"; message: string };

export function parseCancelTokenResult(data: Json | null): CancelTokenResult {
  const o = asObject(data);
  const code = o && str(o, "code");
  if (o?.status === "cancelled" && code) return { status: "cancelled", code };
  if (o?.status === "not_found") {
    return { status: "error", message: "This ticket is no longer in the queue. It may have just boarded." };
  }
  return { status: "error", message: (o && str(o, "message")) ?? "Unexpected response from the server" };
}

export async function cancelToken(client: StopSyncClient, cardId: string, reason: string): Promise<CancelTokenResult> {
  const { data, error } = await client.rpc("cancel_token", { p_card: cardId, p_reason: reason });
  if (error) return { status: "error", message: error.message };
  return parseCancelTokenResult(data);
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

/** Outcome of an action RPC: ok, or a message the screen can show. */
export type ActionResult = { ok: true; data: JsonObject } | { ok: false; message: string };

const FAILED_STATUSES = new Set(["error", "no_bus"]);

export function parseActionResult(data: Json | null): ActionResult {
  const o = asObject(data);
  if (!o) return { ok: true, data: {} };
  if (typeof o.status === "string" && FAILED_STATUSES.has(o.status)) {
    return { ok: false, message: str(o, "message") ?? "Something went wrong" };
  }
  return { ok: true, data: o };
}

async function action(
  call: PromiseLike<{ data: Json | null; error: { message: string } | null }>,
): Promise<ActionResult> {
  const { data, error } = await call;
  if (error) return { ok: false, message: error.message };
  return parseActionResult(data);
}

export const approveDecision = (c: StopSyncClient, id: number) => action(c.rpc("approve_decision", { p_decision: id }));
export const dismissDecision = (c: StopSyncClient, id: number) => action(c.rpc("dismiss_decision", { p_decision: id }));
export const resetBus = (c: StopSyncClient, busId: string) => action(c.rpc("reset_bus", { p_bus: busId }));

/** The bus is back at its terminal: riders get off (tokens → completed), occupancy drops. */
export const completeTrip = (c: StopSyncClient, busId: string, source: "dashboard" | "gps" | "manual") =>
  action(c.rpc("complete_trip", { p_bus: busId, p_source: source }));

/** The driver's −1 / +1 correction to who is on board. */
export const adjustOccupancy = (c: StopSyncClient, busId: string, delta: number) =>
  action(c.rpc("adjust_occupancy", { p_bus: busId, p_delta: delta }));

export const markBusArrived = (c: StopSyncClient, busId: string, source: "dashboard" | "gps" | "manual") =>
  action(c.rpc("mark_bus_arrived", { p_bus: busId, p_source: source }));

/** Speed (m/s) and accuracy (m) are stored in bus_positions; the phone may not know its speed. */
export const updateBusLocation = (
  c: StopSyncClient,
  busId: string,
  coords: { lat: number; lng: number; speed: number | null; accuracy: number | null },
) =>
  action(
    c.rpc("update_bus_location", {
      p_bus: busId,
      p_lat: coords.lat,
      p_lng: coords.lng,
      // The generated types mark these non-null; SQL takes null for "unknown".
      p_speed: coords.speed as number,
      p_accuracy: coords.accuracy as number,
    }),
  );

export async function runDispatch(c: StopSyncClient): Promise<ActionResult> {
  const { error } = await c.rpc("run_dispatch");
  return error ? { ok: false, message: error.message } : { ok: true, data: {} };
}

export async function updateConfig(c: StopSyncClient, key: string, value: number): Promise<ActionResult> {
  const { error } = await c.from("config").update({ value }).eq("key", key);
  return error ? { ok: false, message: error.message } : { ok: true, data: {} };
}

export { num as jsonNumber, str as jsonString };

export interface LogSelectionArgs {
  stopId: string;
  destination: string;
  method: "voice" | "gesture" | "manual";
  confidence: number | null;
  outcome: "confirmed" | "changed" | "cancelled" | "timeout";
  tokenCode: string | null;
}

export const logSelection = (c: StopSyncClient, a: LogSelectionArgs) =>
  action(
    c.rpc("log_selection", {
      p_stop: a.stopId,
      p_dest: a.destination,
      p_method: a.method,
      // Generated types mark these non-null; the SQL accepts null for both.
      p_conf: a.confidence ?? (null as unknown as number),
      p_outcome: a.outcome,
      ...(a.tokenCode !== null ? { p_token: a.tokenCode } : {}),
    }),
  );

export const resetDemo = (c: StopSyncClient) => action(c.rpc("reset_demo"));
