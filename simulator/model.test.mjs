import assert from "node:assert/strict";
import { test } from "node:test";
import { expectedArrivals, kigaliMinutes, parseArgs, poisson, profileAt } from "./model.mjs";

test("Kigali time is UTC+2", () => {
  assert.equal(kigaliMinutes(new Date("2026-10-27T05:30:00Z")), 7 * 60 + 30);
  assert.equal(kigaliMinutes(new Date("2026-10-27T23:00:00Z")), 60);
});

test("peak windows", () => {
  assert.equal(profileAt(new Date("2026-10-27T05:30:00Z")), "peak"); // 07:30
  assert.equal(profileAt(new Date("2026-10-27T10:00:00Z")), "offpeak"); // 12:00
  assert.equal(profileAt(new Date("2026-10-27T15:00:00Z")), "peak"); // 17:00
  assert.equal(profileAt(new Date("2026-10-27T17:30:00Z")), "offpeak"); // 19:30
});

test("arrival rate scales with tick and speed", () => {
  assert.equal(expectedArrivals("peak", 60, 1), 2);
  assert.equal(expectedArrivals("offpeak", 1, 60), 0.3);
});

test("poisson mean is about lambda", () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let total = 0;
  for (let i = 0; i < 20000; i++) total += poisson(0.5, random);
  assert.ok(Math.abs(total / 20000 - 0.5) < 0.03);
  assert.equal(poisson(0), 0);
});

test("argument parsing", () => {
  assert.deepEqual(parseArgs([]), {
    command: "run",
    opts: { speed: 1, profile: "auto", minutes: null, stops: null, dryRun: false },
  });
  const { command, opts } = parseArgs(["--speed", "30", "--profile", "peak", "--stops", "STOP-02, STOP-03"]);
  assert.equal(command, "run");
  assert.equal(opts.speed, 30);
  assert.deepEqual(opts.stops, ["STOP-02", "STOP-03"]);
  assert.equal(parseArgs(["clear"]).command, "clear");
  assert.throws(() => parseArgs(["--speed", "0"]));
  assert.throws(() => parseArgs(["--bogus"]));
});
