// Pure helpers for the simulator (tested in model.test.mjs).

/** Passengers per stop per minute. */
export const RATES = { peak: 2.0, offpeak: 0.3 };

/** Kigali rush hours, minutes after midnight: 06:30–09:00 and 16:30–19:30. */
export const PEAK_WINDOWS = [
  [6 * 60 + 30, 9 * 60],
  [16 * 60 + 30, 19 * 60 + 30],
];

/** Minutes after midnight in Kigali (UTC+2, no daylight saving). */
export function kigaliMinutes(date) {
  return (date.getUTCHours() * 60 + date.getUTCMinutes() + 120) % (24 * 60);
}

export function profileAt(date) {
  const m = kigaliMinutes(date);
  return PEAK_WINDOWS.some(([from, to]) => m >= from && m < to) ? "peak" : "offpeak";
}

/** Poisson sample with mean lambda (Knuth; fine for small lambda). */
export function poisson(lambda, random = Math.random) {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= random();
  } while (p > limit);
  return k - 1;
}

/** Expected arrivals at one stop during one tick. */
export function expectedArrivals(profile, tickSeconds, speed) {
  return (RATES[profile] / 60) * tickSeconds * speed;
}

export function pick(items, random = Math.random) {
  return items[Math.floor(random() * items.length)];
}

/** Parse "--key value" / "--flag" arguments after an optional command. */
export function parseArgs(argv) {
  const [first, ...rest] = argv;
  const command = first && !first.startsWith("--") ? first : "run";
  const tokens = command === first ? rest : argv;
  const opts = { speed: 1, profile: "auto", minutes: null, stops: null, dryRun: false };
  for (let i = 0; i < tokens.length; i++) {
    const key = tokens[i];
    const next = () => {
      const value = tokens[++i];
      if (value === undefined) throw new Error(`${key} needs a value`);
      return value;
    };
    switch (key) {
      case "--speed":
        opts.speed = Number(next());
        if (!(opts.speed > 0)) throw new Error("--speed must be a positive number");
        break;
      case "--profile":
        opts.profile = next();
        if (!["auto", "peak", "offpeak"].includes(opts.profile)) throw new Error("--profile is auto, peak or offpeak");
        break;
      case "--minutes":
        opts.minutes = Number(next());
        if (!(opts.minutes > 0)) throw new Error("--minutes must be a positive number");
        break;
      case "--stops":
        opts.stops = next().split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      default:
        throw new Error(`Unknown option ${key}`);
    }
  }
  if (!["run", "clear", "help"].includes(command)) throw new Error(`Unknown command ${command}`);
  return { command, opts };
}
