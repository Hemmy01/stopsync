# StopSync

A smart bus stop prototype for Kigali: a **digital waiting list for buses**.
Built in the CMU-Africa Bridge Program.

1. A passenger **taps a card** at the kiosk.
2. They choose their stop by **voice** or a **tap gesture** over the proximity sensor
   (two Edge Impulse models on an Arduino Nano 33 BLE Sense Lite).
3. They confirm and get a **queue number** such as `R3-014`.
4. HQ sees live demand on a **dashboard**, gets a "release a bus" recommendation, and approves it.
5. The kiosk shows the **bus status and ETA**, updated from the driver's phone GPS.
6. When the bus arrives, waiting passengers are marked **boarded**.

**Sense** (who is waiting) → **Decide** (when to send a bus) → **Inform** (number and ETA).
Architecture diagrams: [`docs/architecture.md`](docs/architecture.md).

| Screen | Path | Used on |
|---|---|---|
| Home | `/` | anywhere |
| Kiosk | `/kiosk` | laptop at the stop, Chrome, board plugged in by USB |
| HQ dashboard | `/dashboard` | desktop or tablet |
| Bus driver | `/bus` | phone in the bus (needs HTTPS for GPS) |
| About | `/about` | judges; printable |

---

## Repository

```
apps/web/                 Next.js app (kiosk, dashboard, bus page, about)
supabase/                 migrations, seed and CLI config
firmware/kiosk_node/      Arduino sketch: protocol, LEDs, rule taps, voice + gesture model hooks
firmware/README.md        build/upload, tuning, two-model options, "When the models arrive"
ml/collect/tap_logger/    20 Hz prox,clear stream for Edge Impulse data collection
ml/exports/               Edge Impulse Arduino library zips go here
ml/results/               voice.md, gestures.md (accuracy and on-board tests)
simulator/                extra stops at peak/off-peak rates
docs/                     protocol, architecture, demo script, rehearsal checklist
```

Stack: Next.js 16 · TypeScript (strict) · Tailwind CSS 4 · Supabase (Postgres, Realtime, pg_cron) ·
Vitest · arduino-cli · Edge Impulse.

---

## Run the web app (5 minutes)

You need **Node.js 20.9+** (21+ for the simulator) and **Chrome or Edge** (Web Serial only works there).

```zsh
git clone https://github.com/Hemmy01/stopsync.git
cd stopsync/apps/web
npm install
cp ../.env.example .env.local     # fill the NEXT_PUBLIC_* lines; leave the SUPABASE_* (CLI) lines empty
npm run dev                        # http://localhost:3000
```

`apps/web/.env.local` (ask Danny for the URL and anon key):

```zsh
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
NEXT_PUBLIC_STOP_ID=STOP-01
```

Use the **anon / publishable** key only; never the `service_role` or secret key. `.env*` files are
git-ignored; only `.env.example` is committed. The shared Supabase project is already set up.

**Without the board:** open <http://localhost:3000/kiosk?mock=1> or press **D** on the kiosk. The
debug drawer emits every board message (`HELLO`, `STATE`, `LOG`, `SELECT` for each stop) through the
same parser as real serial, and shows the raw serial log.

| Command (in `apps/web`) | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run lint` · `npm run typecheck` | ESLint · route types + `tsc --noEmit` |
| `npm test` | Vitest: protocol, kiosk reducer, ETA, dashboard, serial, GPS, models.json, config.h consistency |
| `npm run build` | Production build |
| `npm run check` | All of the above in order (run before every commit) |

---

## Firmware: build and upload the board

Full guide: [`firmware/README.md`](firmware/README.md). Protocol: [`docs/protocol.md`](docs/protocol.md).

```zsh
# once
arduino-cli core install arduino:mbed_nano
arduino-cli lib install Arduino_APDS9960
arduino-cli config set library.enable_unsafe_install true

# every time (from the repo root)
arduino-cli board list                                   # e.g. /dev/cu.usbmodem1101
arduino-cli compile --fqbn arduino:mbed_nano:nano33ble firmware/kiosk_node
arduino-cli upload  --fqbn arduino:mbed_nano:nano33ble -p /dev/cu.usbmodem1101 firmware/kiosk_node
firmware/scripts/compile-all.sh                          # every config that doesn't need model zips
```

The default build is `VOICE_OFF` + `GESTURE_RULE`: taps work today without any model.
Then on `/kiosk`: **Connect board** → choose the Arduino (**Any port** lists every serial device).
Close any Serial Monitor first: only one program can open the port. After the first time the kiosk
reconnects by itself on reload and when the board is plugged back in.

| Stop | Say | Over the sensor | Board LED after SELECT |
|---|---|---|---|
| Remera (R2) | "Remera" | Tap once | green |
| Downtown (R4) | "Downtown" | Tap twice | purple |
| Nyabugogo (R1) | "Nyabugogo" | Tap 3 times | blue |
| Kimironko (R3) | "Kimironko" | Hold your hand still | yellow |

The mapping lives in `supabase/seed.sql`, `apps/web/lib/destinations.ts` and
`firmware/kiosk_node/config.h`; `tests/firmware-config.test.ts` fails if config.h drifts.

### Dropping in the Edge Impulse models

1. Export each project as an **Arduino library** into `ml/exports/`
   (`stopsync_voice_inferencing.zip`, `stopsync_gestures_inferencing.zip`).
2. `arduino-cli lib install --zip-path ml/exports/<zip>`
3. In `config.h` set `VOICE_MODE VOICE_MODEL` (and/or `GESTURE_MODE GESTURE_MODEL`; both at once needs
   the multi-impulse option).
4. Compile, upload, test each stop 10 times, record results in `ml/results/`, update
   `apps/web/content/models.json`.

Exact commands, label checks and threshold tuning: "When the models arrive" in `firmware/README.md`.

---

## Supabase

Everything in the database comes from `supabase/migrations/` and `supabase/seed.sql`.

| Table / view | Holds |
|---|---|
| `stops` | The kiosk (`STOP-01`) and simulator stops `STOP-02`…`STOP-06` |
| `destinations` | NYA Nyabugogo R1 · REM Remera R2 · KIM Kimironko R3 · DTN Downtown R4, with voice/gesture labels |
| `queue_tokens` | Queue numbers and their status (`waiting` / `boarded` / `expired`) |
| `buses` · `bus_events` | 2 buses per route (status, GPS, ETA) · released / arrived / reset history |
| `dispatch_decisions` | Release / hold recommendations and HQ decisions |
| `selection_events` | Every board/screen choice and its outcome (confirmed / changed / cancelled / timeout) |
| `config` | Dispatch rules, editable on the dashboard |
| `model_insights_today` (view) | Per method today: selections, confirmation rate, average confidence |

Functions: `create_token`, `run_dispatch` (every minute via **pg_cron**), `approve_decision`,
`dismiss_decision`, `update_bus_location`, `mark_bus_arrived`, `reset_bus`, `log_selection`, `reset_demo`.

### Changing the schema (Danny)

Put the CLI values in a git-ignored `.env.local` at the repo root
(`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`; see `.env.example`), then:

```zsh
set -a && . ./.env.local && set +a
npx supabase link --project-ref "$SUPABASE_PROJECT_REF" -p "$SUPABASE_DB_PASSWORD"
npx supabase migration new <name>          # write SQL in the new file; never edit applied ones
npx supabase db push --linked              # apply to the project
npx supabase gen types typescript --linked --schema public > apps/web/lib/database.types.ts
```

### Setting up a brand-new Supabase project

1. Create the project at <https://supabase.com/dashboard>.
2. Fill the root `.env.local` as above and run `link`.
3. `npx supabase db push --linked --include-seed` applies all migrations and the seed
   (tables, functions, RLS, Realtime and the pg_cron job).
4. Copy the project URL and anon key into `apps/web/.env.local`.

### ⚠️ Prototype security

This prototype has **no authentication**. Every table has an open RLS policy
(`using (true) with check (true)`) for `anon`, and the business functions (including `reset_demo`)
are `security definer` and callable by `anon`. Anyone with the anon key can read and change data.
**Before any real use, add authentication and per-role policies** (e.g. only HQ can approve or reset,
only a driver can move their bus).

---

## Network simulator

`simulator/` adds passengers at `STOP-02`…`STOP-06` so the dashboard shows city-wide demand.
Node 21+, no dependencies, reads the public values from `apps/web/.env.local`.

```zsh
node simulator/simulate.mjs                          # Kigali clock decides peak or off-peak
node simulator/simulate.mjs --profile peak           # 2 passengers / min / stop
node simulator/simulate.mjs --speed 60               # an hour of traffic every minute
node simulator/simulate.mjs --minutes 5 --stops STOP-02,STOP-04
node simulator/simulate.mjs --dry-run                # print only, write nothing
node simulator/simulate.mjs clear                    # expire the simulator's waiting tickets
node --test simulator                                # simulator unit tests
```

Stop it with **Ctrl+C**; it prints how many tickets each stop got.

- Rates: peak 06:30–09:00 and 16:30–19:30 Kigali time, 2.0 passengers/min/stop; otherwise 0.3.
- Tickets go through `create_token` with method `rfid` (card only): they count as demand on the
  dashboard and in dispatch, but stay out of "How passengers chose" and Model insights.
- The kiosk's departure strip counts only its own stop; the dashboard counts every stop.
- A bus arriving boards the oldest waiting passengers for its route across all stops.
  **Reset demo** on the dashboard clears everything.

---

## Deploy to Vercel

1. <https://vercel.com/new> → **Import** `Hemmy01/stopsync`.
2. **Root Directory:** `apps/web` (framework preset Next.js, other settings default).
3. **Environment Variables:** the three `NEXT_PUBLIC_*` values from `apps/web/.env.local`
   (Production and Preview).
4. **Deploy.** Every push to a branch gets a Preview URL; `main` is Production.

The `https://` address is required for Web Serial on the kiosk and GPS on the phone's `/bus` page.

---

## Demo and rehearsal

- [`docs/demo-script.md`](docs/demo-script.md): the live demo step by step, with a fallback for every step.
- [`docs/rehearsal-checklist.md`](docs/rehearsal-checklist.md): what to check the day before and an hour before.

## Troubleshooting

| Problem | Fix |
|---|---|
| No **Connect board** button | Use Chrome or Edge on a laptop; Web Serial isn't available elsewhere. |
| "Couldn't open the board" | Close the Arduino Serial Monitor, `arduino-cli monitor` or any other tab using the port. |
| Upload can't find the board | Double-tap the board's reset button (orange LED pulses) and upload again. |
| Taps not recognised / counted twice | Watch `LOG,gesture=…` lines in the kiosk drawer (**D**) and tune `PROX_*` in `config.h`. |
| `/bus` says location only works over HTTPS | Open the deployed `https://` URL on the phone (plain `http://192.168…` won't work). |
| "Supabase is not configured" banner | Create `apps/web/.env.local` with the three values and restart `npm run dev`. |
| Recommendations never change | pg_cron runs `run_dispatch()` every minute; use **Recompute now** to run it immediately. |
