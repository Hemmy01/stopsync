#!/usr/bin/env node
// Gesture reliability trials against a real board, no kiosk needed. No dependencies.
//
//   node firmware/scripts/gesture-trials.mjs --port /dev/cu.usbmodem1101 --label after
//        [--tries 20] [--timeout 8] [--only REM,DTN] [--no-control] [--out FILE]
//
// For each stop: press Enter, then do its gesture once every time the prompt says GO.
// The script sends START, waits for SELECT (or the timeout), sends CANCEL, and repeats.
// A final control block checks that standing still selects nothing.
// Prints a results table and appends it to ml/results/gesture-trials.md.
// Works with any firmware that speaks docs/protocol.md (0.2.0 tap build for "before").
// Close the kiosk tab and every serial monitor first: only one program can open the port.

import { execFileSync } from "node:child_process";
import { appendFileSync, constants, createReadStream, openSync, readFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_H = join(ROOT, "firmware/kiosk_node/config.h");
const DEFAULT_OUT = join(ROOT, "ml/results/gesture-trials.md");

const TAP_HINTS = { one_tap: "Tap once", two_taps: "Tap twice", three_taps: "Tap 3 times", hold: "Hold your hand still" };
const SWIPE_ARROWS = { left: "←", right: "→", up: "↑", down: "↓" };

function parseArgs(argv) {
  const args = { tries: 20, timeout: 8, control: true, only: null, port: null, label: null, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    const [key, value] = [argv[i], argv[i + 1]];
    if (key === "--no-control") args.control = false;
    else if (key === "--port") (args.port = value), i++;
    else if (key === "--label") (args.label = value), i++;
    else if (key === "--tries") (args.tries = Number(value)), i++;
    else if (key === "--timeout") (args.timeout = Number(value)), i++;
    else if (key === "--only") (args.only = value.split(",")), i++;
    else if (key === "--out") (args.out = value), i++;
    else throw new Error(`Unknown option ${key}`);
  }
  if (!args.port || !args.label) throw new Error("Usage: --port /dev/cu.usbmodemXXXX --label before|after [--tries 20]");
  if (!(args.tries > 0) || !(args.timeout > 0)) throw new Error("--tries and --timeout must be positive numbers");
  return args;
}

/** The DESTINATIONS[] table from config.h (same parser idea as apps/web/tests/firmware-config.test.ts). */
function readDestinations() {
  const source = readFileSync(CONFIG_H, "utf8");
  const table = source.match(/DESTINATIONS\[\]\s*=\s*\{([\s\S]*?)\n\};/);
  if (!table) throw new Error("DESTINATIONS[] table not found in config.h");
  const row = /\{\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/g;
  return [...table[1].matchAll(row)].map(([, code, route, , swipeLabel, tapLabel]) => ({ code, route, swipeLabel, tapLabel }));
}

function gestureFor(dest, mode) {
  if (mode === "rule" || mode === "model") return TAP_HINTS[dest.tapLabel] ?? dest.tapLabel;
  const direction = dest.swipeLabel.replace("swipe_", "");
  return `${SWIPE_ARROWS[direction] ?? ""} Swipe ${direction}`.trim();
}

/** Line-based serial connection over a tty, configured with stty on the open descriptor. */
function openBoard(port) {
  const fd = openSync(port, constants.O_RDWR | constants.O_NOCTTY);
  // stty acts on its stdin: our descriptor, so the settings hold while we keep it open.
  execFileSync("stty", ["115200", "raw", "-echo", "-hupcl"], { stdio: [fd, "ignore", "pipe"] });

  const waiters = [];
  const listeners = [];
  let pending = "";
  const stream = createReadStream("", { fd, encoding: "utf8", autoClose: false });
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      listeners.forEach((fn) => fn(line));
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].match(line)) waiters.splice(i, 1)[0].resolve(line);
      }
    }
  });
  stream.on("error", (err) => {
    console.error(`Serial error: ${err.message}`);
    process.exit(1);
  });

  return {
    send(line) {
      writeSync(fd, `${line}\n`);
    },
    /** Returns a function that stops listening. */
    onLine(fn) {
      listeners.push(fn);
      return () => listeners.splice(listeners.indexOf(fn), 1);
    },
    /** Resolves with the first line matching, or null after ms. */
    waitFor(match, ms) {
      return new Promise((resolve) => {
        const waiter = { match, resolve };
        waiters.push(waiter);
        setTimeout(() => {
          const i = waiters.indexOf(waiter);
          if (i >= 0) waiters.splice(i, 1), resolve(null);
        }, ms);
      });
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
};

/** One try: START, wait for a SELECT. Returns { code, method, ms, events } or null on timeout. */
async function runTry(board, timeoutMs, onGo) {
  const events = [];
  const collect = (line) => line.startsWith("LOG,gesture=") && events.push(line.slice(4));
  const stop = board.onLine(collect);

  board.send("START");
  const listening = await board.waitFor((l) => l === "STATE,LISTENING", 2000);
  if (!listening) console.log("  (no STATE,LISTENING; is this the kiosk_node firmware?)");
  const started = Date.now();
  onGo();
  const select = await board.waitFor((l) => l.startsWith("SELECT,"), timeoutMs);
  const ms = Date.now() - started;
  board.send("CANCEL");
  await sleep(300);  // let STATE,IDLE and the last LOG lines arrive
  stop();

  if (!select) return { code: null, method: null, ms: null, events };
  const [, code, method] = select.split(",");
  return { code, method, ms, events };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let destinations = readDestinations();
  if (args.only) destinations = destinations.filter((d) => args.only.includes(d.code));
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const board = openBoard(args.port);
  const boot = { hello: null, modes: null };
  board.onLine((line) => {
    if (line.startsWith("HELLO,")) boot.hello = line;
    if (line.startsWith("LOG,voice=")) boot.modes = line.slice(4);
  });
  // Opening the port raises DTR, so the board sends HELLO and its modes line.
  await board.waitFor((l) => l.startsWith("LOG,voice="), 4000);
  if (!boot.hello) console.log("No HELLO yet; carrying on (replug the board if nothing works).");
  const mode = /gesture=(\w+)/.exec(boot.modes ?? "")?.[1] ?? "swipe";
  const fw = /fw=([\w.]+)/.exec(boot.modes ?? "")?.[1] ?? "unknown";
  console.log(`\nBoard: ${boot.modes ?? "no modes line (firmware before 0.2.0?)"}`);
  console.log(`Gesture mode: ${mode} · ${args.tries} tries per gesture · ${args.timeout} s each\n`);
  if (/voice=model/.test(boot.modes ?? "")) {
    console.log("Voice is on: keep the room quiet, or use a VOICE_OFF build so speech can't select.\n");
  }

  const rows = [];
  for (const dest of destinations) {
    const gesture = gestureFor(dest, mode);
    await rl.question(`Next: ${gesture}  (expects ${dest.code})  ×${args.tries}. Press Enter to start.`);
    const results = [];
    for (let n = 1; n <= args.tries; n++) {
      const r = await runTry(board, args.timeout * 1000, () => process.stdout.write(`  [${n}/${args.tries}] GO: ${gesture} … `));
      results.push(r);
      const verdict = r.code === dest.code && r.method === "gesture" ? "hit" : r.code ? `WRONG ${r.code} (${r.method})` : "miss";
      console.log(`${verdict}${r.ms !== null ? ` · ${r.ms} ms` : ""}${r.events.length ? ` · ${r.events.join(" ")}` : ""}`);
      await sleep(700);
    }
    const hits = results.filter((r) => r.code === dest.code && r.method === "gesture");
    const wrong = results.filter((r) => r.code && !(r.code === dest.code && r.method === "gesture"));
    rows.push({
      label: `${gesture} → ${dest.code}`,
      hits: hits.length,
      wrong: wrong.map((r) => `${r.code}/${r.method}`).join(", "),
      missed: results.filter((r) => !r.code).length,
      medianMs: median(hits.map((r) => r.ms)),
    });
  }

  if (args.control) {
    await rl.question(`Control: stand in front of the board and do nothing ×${args.tries}. Press Enter to start.`);
    const quietMs = Math.min(args.timeout, 5) * 1000;
    let falseSelects = 0;
    const wrong = [];
    for (let n = 1; n <= args.tries; n++) {
      const r = await runTry(board, quietMs, () => process.stdout.write(`  [${n}/${args.tries}] do nothing … `));
      if (r.code) falseSelects++, wrong.push(`${r.code}/${r.method}`);
      console.log(r.code ? `FALSE SELECT ${r.code} (${r.method})` : "ok");
      await sleep(300);
    }
    rows.push({ label: "Do nothing → (none)", hits: args.tries - falseSelects, wrong: wrong.join(", "), missed: 0, medianMs: null });
  }

  rl.close();

  const date = new Date().toISOString().slice(0, 10);
  const table = [
    `### ${args.label} · ${date} · fw ${fw} · gesture=${mode}`,
    "",
    `\`${boot.modes ?? "no modes line"}\` · ${args.tries} tries each · ${args.timeout} s timeout`,
    "",
    "| Gesture → stop | Correct | Wrong stop | Missed | Hit rate | Median time |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.label} | ${r.hits}/${args.tries} | ${r.wrong || "—"} | ${r.missed} | ${Math.round((r.hits / args.tries) * 100)}% | ${r.medianMs === null ? "—" : `${r.medianMs} ms`} |`,
    ),
    "",
    "",
  ].join("\n");

  console.log(`\n${table}`);
  appendFileSync(args.out, table);
  console.log(`Appended to ${args.out}`);
  // Exit closes the port. (Closing a tty while a read is pending can block on macOS.)
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
