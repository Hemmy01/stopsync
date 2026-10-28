#!/usr/bin/env node
// Tap&Select network simulator: passengers arriving at stops STOP-02…STOP-06.
//
//   node simulator/simulate.mjs [run] [--speed 1] [--profile auto|peak|offpeak]
//                               [--minutes N] [--stops STOP-02,STOP-03] [--dry-run]
//   node simulator/simulate.mjs clear     # expire the simulator's waiting tickets
//
// Tickets go through the same create_token() function as the kiosk. They are
// stored with method "rfid" (card only), so they count as demand on the
// dashboard and in dispatch but never in the voice/gesture model statistics.
// Uses only the public anon key from apps/web/.env.local (or the environment).

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expectedArrivals, parseArgs, pick, poisson, profileAt } from "./model.mjs";

const SIM_STOPS = ["STOP-02", "STOP-03", "STOP-04", "STOP-05", "STOP-06"];
const TICK_SECONDS = 1;

const HELP = `Tap&Select simulator

  node simulator/simulate.mjs [run] [options]   start creating tickets (Ctrl+C to stop)
  node simulator/simulate.mjs clear             expire the simulator's waiting tickets

Options:
  --speed N        simulated seconds per real second (default 1; 60 = an hour a minute)
  --profile P      auto (Kigali clock), peak (2/min/stop) or offpeak (0.3/min/stop)
  --minutes N      stop after N real minutes
  --stops LIST     comma-separated subset of ${SIM_STOPS.join(",")}
  --dry-run        print what would be created, write nothing`;

function loadEnv() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  for (const file of [join(root, "apps/web/.env.local"), join(root, ".env.local")]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (apps/web/.env.local).");
  }
  return { url: url.replace(/\/$/, ""), key };
}

function api({ url, key }) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const request = async (path, init = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
  return {
    destinations: () => request("destinations?select=code,name,route&order=sort_order"),
    stops: (ids) => request(`stops?select=id,name&id=in.(${ids.join(",")})&order=id`),
    createToken: (stop, dest, card) =>
      request("rpc/create_token", {
        method: "POST",
        body: JSON.stringify({ p_stop: stop, p_dest: dest, p_card: card, p_method: "rfid" }),
      }),
    expireWaiting: (ids) =>
      request(`queue_tokens?stop_id=in.(${ids.join(",")})&status=eq.waiting&select=id`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "expired" }),
      }),
  };
}

const clock = (date) =>
  date.toLocaleTimeString("en-GB", { timeZone: "Africa/Kigali", hour12: false });

async function run(db, opts) {
  const stopIds = opts.stops ?? SIM_STOPS;
  const unknown = stopIds.filter((s) => !SIM_STOPS.includes(s));
  if (unknown.length) throw new Error(`Not a simulator stop: ${unknown.join(", ")}`);

  const [destinations, stops] = await Promise.all([db.destinations(), db.stops(stopIds)]);
  if (stops.length !== stopIds.length) {
    throw new Error("Simulator stops missing: run `npx supabase db push` (migration 20261027210000_simulator_stops).");
  }

  const started = Date.now();
  const simStart = new Date();
  const counts = Object.fromEntries(stopIds.map((s) => [s, 0]));
  let failures = 0;
  let serial = 0;
  let lastProfile = null;

  console.log(
    `Simulating ${stopIds.length} stops · speed ×${opts.speed} · profile ${opts.profile}` +
      `${opts.minutes ? ` · ${opts.minutes} min` : ""}${opts.dryRun ? " · DRY RUN" : ""}. Ctrl+C to stop.`,
  );

  let stopping = false;
  const finish = () => {
    if (stopping) return;
    stopping = true;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const verb = opts.dryRun ? "would have been created" : "created";
    console.log(`\nStopped. ${total} tickets ${verb}${failures ? `, ${failures} failed` : ""}.`);
    for (const s of stops) console.log(`  ${s.id} ${s.name.padEnd(20)} ${counts[s.id]}`);
    console.log("Tickets stay waiting until a bus arrives. `node simulator/simulate.mjs clear` expires them.");
    process.exit(failures && !total ? 1 : 0);
  };
  process.on("SIGINT", finish);
  process.on("SIGTERM", finish);

  while (!stopping) {
    const elapsed = (Date.now() - started) / 1000;
    if (opts.minutes && elapsed >= opts.minutes * 60) finish();

    const simNow = new Date(simStart.getTime() + elapsed * 1000 * opts.speed);
    const profile = opts.profile === "auto" ? profileAt(simNow) : opts.profile;
    if (profile !== lastProfile) {
      console.log(`${clock(simNow)}  ${profile === "peak" ? "Peak hour" : "Off-peak"} traffic`);
      lastProfile = profile;
    }

    const lambda = expectedArrivals(profile, TICK_SECONDS, opts.speed);
    for (const stop of stops) {
      for (let n = poisson(lambda); n > 0; n--) {
        const dest = pick(destinations);
        const card = `SIM-${stop.id}-${Date.now().toString(36)}-${(serial++).toString(36)}`;
        if (opts.dryRun) {
          counts[stop.id]++;
          console.log(`${clock(simNow)}  ${stop.id} → ${dest.route} ${dest.name} (dry run)`);
          continue;
        }
        try {
          const result = await db.createToken(stop.id, dest.code, card);
          if (result?.status !== "created") throw new Error(JSON.stringify(result));
          counts[stop.id]++;
          console.log(`${clock(simNow)}  ${stop.id} → ${result.code} ${dest.name} (position ${result.position})`);
        } catch (err) {
          failures++;
          console.error(`${clock(simNow)}  ${stop.id} failed: ${err.message}`);
        }
      }
    }
    await new Promise((r) => setTimeout(r, TICK_SECONDS * 1000));
  }
}

async function clear(db) {
  const expired = await db.expireWaiting(SIM_STOPS);
  console.log(`Expired ${expired.length} waiting simulator tickets (stops ${SIM_STOPS[0]}…${SIM_STOPS.at(-1)}).`);
}

try {
  const { command, opts } = parseArgs(process.argv.slice(2));
  if (command === "help") {
    console.log(HELP);
  } else {
    const db = api(loadEnv());
    if (command === "clear") await clear(db);
    else await run(db, opts);
  }
} catch (err) {
  console.error(`simulator: ${err.message}\n\n${HELP}`);
  process.exit(1);
}
