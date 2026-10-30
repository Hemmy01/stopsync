# Tap&Select

A smart bus stop prototype for Kigali: a **digital waiting list for buses**.
Built in the CMU-Africa Bridge Program.

1. A passenger **taps a card** at the kiosk.
2. They choose their stop by **voice** or a **tap gesture** over the proximity sensor
   on an Arduino Nano 33 BLE Sense Lite: an Edge Impulse voice model and, for now, a rule-based tap
   detector (a trained tap model is planned).
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
git clone https://github.com/Hemmy01/tap-and-select.git
cd tap-and-select/apps/web
npm install
cp ../.env.example .env.local     # fill the NEXT_PUBLIC_* lines; leave the SUPABASE_* (CLI) lines empty
npm run dev                        # http://localhost:3000
```

`apps/web/.env.local` (ask Danny for the URL and anon key):

```zsh
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
NEXT_PUBLIC_STOP_ID=STOP-01
NEXT_PUBLIC_DEMO_MODE=true          # shows "Demo login as…" on /login
DEMO_PASSWORD=<the demo accounts' password>   # server-only, ask Danny
```

Every screen needs a signed-in account (see [Accounts and roles](#accounts-and-roles)); open
<http://localhost:3000/login> and use **Demo login as…**.

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

The default build is `VOICE_MODEL` + `GESTURE_SWIPE`: the trained voice model plus swipes read by the
APDS9960's own direction engine (on a separate thread, so voice never slows it). The older tap rules are
still a build switch (`GESTURE_RULE`); the kiosk shows tap hints automatically when the board runs them.
It needs the voice library installed once:
`arduino-cli lib install --zip-path "ml/exports/ei-tap-and-select-voice-arduino-1.0.1-impulse-#1.zip"`.
Then on `/kiosk`: **Connect board** → choose the Arduino (**Any port** lists every serial device).
Close any Serial Monitor first: only one program can open the port. After the first time the kiosk
reconnects by itself on reload and when the board is plugged back in.

| Stop | Say | Swipe over the sensor | Tap build | Board LED after SELECT |
|---|---|---|---|---|
| Remera (R2) | "Remera" | ← Swipe left | Tap once | green |
| Downtown (R4) | "Downtown" | → Swipe right | Tap twice | purple |
| Nyabugogo (R1) | "Nyabugogo" | ↑ Swipe up | Tap 3 times | blue |
| Kimironko (R3) | "Kimironko" | ↓ Swipe down | Hold your hand still | yellow |

The mapping lives in `supabase/seed.sql`, `apps/web/lib/destinations.ts` and
`firmware/kiosk_node/config.h`; `tests/firmware-config.test.ts` fails if config.h drifts.
If "left" comes out wrong once the board is mounted, see firmware/README.md, "Swipes" (orientation flags).
Gesture reliability is measured with `firmware/scripts/gesture-trials.mjs` (`ml/results/gesture-trials.md`).

### Edge Impulse models

| Model | Status | Library |
|---|---|---|
| Voice | trained, in the default build | `tap-and-select-voice_inferencing` (`ml/exports/ei-tap-and-select-voice-*.zip`) |
| Gestures | rule-based taps until exported | set `GESTURE_MODEL_HEADER` in `config.h` |

Board test script, `DEBUG_SCORES` tuning and troubleshooting (port busy, wrong library, overrun):
[`firmware/README.md`](firmware/README.md). Results go in `ml/results/` and `apps/web/content/models.json`.

---

## Supabase

Everything in the database comes from `supabase/migrations/` and `supabase/seed.sql`.

| Table / view | Holds |
|---|---|
| `stops` | The kiosk (`STOP-01`), the route terminals `STOP-02`…`STOP-06` and stops along the routes `STOP-07`…`STOP-17` |
| `routes_stops` · `terminals` | Each route's stops in order with distance from its terminal · terminal location and departure radius (150 m) |
| `destinations` | NYA Nyabugogo R1 · REM Remera R2 · KIM Kimironko R3 · DTN Downtown R4, with voice/gesture labels |
| `queue_tokens` | Queue numbers and their status (`waiting` / `boarded` / `completed` / `expired`), and the bus boarded |
| `buses` · `bus_events` | 2 buses per route (status, GPS, ETA, last/next stop, stops and distance left, seats/standing/occupancy) · released / departed / arrived / completed / occupancy history |
| `bus_positions` | GPS history (speed, accuracy); rows older than 24 h are deleted hourly by pg_cron |
| `dispatch_decisions` | Release / hold recommendations and HQ decisions |
| `selection_events` | Every board/screen choice and its outcome (confirmed / changed / cancelled / timeout) |
| `config` | Dispatch rules, editable on the dashboard |
| `model_insights_today` (view) | Per method today: selections, confirmation rate, average confidence |

Functions: `create_token`, `run_dispatch` (every minute via **pg_cron**), `approve_decision`,
`dismiss_decision`, `update_bus_location`, `mark_bus_arrived`, `complete_trip`, `adjust_occupancy`,
`reset_bus`, `log_selection`, `reset_demo`, `cancel_token` (and the internal `board_queue`, `release_for_decision`).

**Live tracking.** Each GPS fix from `/bus` (`update_bus_location`) is stored in `bus_positions`, then
projected onto the bus's route: that gives the last stop passed, the next stop, stops remaining
and the distance left along the route; ETA = distance left ÷ `avg_bus_speed_kmh`. A released bus
that leaves its terminal radius logs `departed`; inside `arrival_radius_m` of the kiosk it arrives
and passengers board. More than `off_route_m` (500 m) from the route, the ETA falls back to a
straight line to the kiosk. The dashboard shows every bus on a Leaflet + OpenStreetMap map; the
kiosk ticket shows a stop-by-stop strip ("Bus R2-01 · passed Kimihurura · 2 stops away · about 6 min").
Stop coordinates are approximate.

**Driver phone (`/bus`).** The driver picks their bus once (the phone remembers it). When HQ
releases that bus, GPS sharing starts by itself; it stops by itself when the bus arrives at the
end of its route (the kiosk). While tracking, the page shows **Tracking on** and keeps the screen
awake (Screen Wake Lock API). Phones pause location for hidden pages and locked screens, so the
page tells the driver how long tracking was lost and how to unblock location if it was refused.

**Seats and occupancy.** Every bus has 40 seats + 30 standing places and an `occupancy` count.
Boarding at the kiosk (`mark_bus_arrived`) takes at most the bus's free places and adds them to
`occupancy`; those tickets remember the bus. Riders get off at the end of the line, back at the
route's terminal: GPS inside the terminal radius, the driver's **Back at terminal** or HQ's
**Reset bus** calls `complete_trip`, which marks their tickets `completed` and lowers occupancy.
The driver corrects the count with − / + (`adjust_occupancy`, logged as an `occupancy` event).
Dispatch uses free places: load = waiting passengers the buses already on the way can't take
÷ free places on the next bus, so a nearly full bus on the way can trigger a second release.
Future: Tap&Go validator taps or door counters for exact counts.

> **Production: a fixed GPS tracker (AVL) in each bus.** A phone page is a prototype stand-in:
> it depends on the driver's phone, battery and an open browser tab. A real deployment would
> fit every bus with an Automatic Vehicle Location unit (GPS + LTE, powered by the bus) that
> reports to the same `update_bus_location` function, with no driver action at all.

**Automatic queue (FIFO).** Each stop has its own queue per route. When a bus arrives at a stop,
`board_queue` boards the oldest waiting tickets for its route at that stop, up to its free places
(seats + standing), under a lock per route and stop so two buses never take the same tickets.
Everyone else keeps their order, and the kiosk ticket shows its live position. This happens:
- at the kiosk: GPS inside `arrival_radius_m`, the driver's **I've arrived**, or HQ's **Bus arrived**;
- along the route: GPS within `arrival_radius_m` of a stop on the bus's route (a released bus also
  boards at its terminal), which is how the simulator's tickets at `STOP-02`…`STOP-06` are served;
- for early or unscheduled buses (never released by HQ) the same way.

The kiosk shows a **Now boarding** row ("R2-01 boarding tickets R2-010–R2-045"), and a called
ticket says "Your bus is here, please board". Dispatch only counts tickets at stops the route
serves. **Auto-dispatch** (`auto_dispatch` = 1 in Settings, off by default) lets `run_dispatch`
release a bus by itself when load ≥ `release_load_pct`, at most `max_auto_releases_per_hour` per
route; past the limit the recommendation waits for HQ as usual.

**Cancelling a place.** Tapping a card that already has a waiting ticket shows the ticket, the
live bus progress and **Cancel my place** → a reason (big tiles, from the `cancel_reasons` table)
→ **Yes, cancel my place**. `cancel_token(card, reason)` marks the ticket `cancelled` with its
reason and time, the people behind move up, and the kiosk sends `CANCEL` to the board. A boarded
ticket can't be cancelled. The dashboard shows **Why people left (today)** and the cancellation
rate (cancelled today ÷ tickets issued or cancelled today).

**Simulate drive (presentation aid).** On the dashboard, a released bus has **Simulate drive**: it
moves along its real route from the terminal to the kiosk in about a minute (one step every 1.5 s),
through `simulate_bus_position` (dispatcher or admin, only for a bus on the way), which runs the same
`update_bus_location` logic as a phone. Departure, boarding at stops along the route, the kiosk's
route strip, ETA and arrival all happen as with real GPS (events are logged as GPS). It runs in that
browser tab and keeps going while you switch to the kiosk, live board or any other page in the app
(use the in-app links, not the address bar); closing or reloading the tab, or **Stop simulated drive**,
leaves the bus where it is.

### Kiosk languages

The kiosk has an **English | Kinyarwanda** switch in its top bar (remembered in that browser).
Every passenger-facing string lives in `apps/web/lib/kiosk-text.ts`; English reuses the existing
labels (gesture hints from `destinations.ts`, cancel reasons from the database). Operator-only text
(board banners, the debug drawer, the demo card picker) stays English, and stop names and spoken
keywords never change ("Vuga “Remera”").

> **The Kinyarwanda text is a draft written without a native speaker.** Before showing it to the
> public, have a Kinyarwanda speaker read every `rw` string in `kiosk-text.ts`; fixes are one-line
> edits there. A test fails if any string is empty or left in English.

### Spoken announcements

The kiosk reads out each new ticket ("Your number is R 2, 0 0 4, to Remera.") and each new boarding
call ("Bus R 2, 0 1 to Remera is now boarding tickets …"), with the browser's built-in voice
(`speechSynthesis`, no extra software). Codes are spelled digit by digit. The speaker icon in the top bar mutes it
(remembered in that browser). Announcements are **held while the board is listening**, so the kiosk
never says a stop name into the board's microphone. They are always in English, since browsers rarely ship a
Kinyarwanda voice. Chrome only starts speaking after someone has clicked on the page once, which a
card tap does.

### SQL scenario tests

```zsh
supabase/tests/run.sh                                         # every supabase/tests/*_test.sql
supabase/tests/run.sh --with supabase/migrations/<new>.sql    # try a migration before pushing it
```

Each test runs inside a transaction against the linked project and **always rolls back**, so it is
safe on the real database. `fifo_queue_test.sql` checks 27 boarding, dispatch and auto-dispatch
scenarios and `cancel_token_test.sql` 9 cancellation ones; a failure prints the check's name and exits non-zero. (pgTAP needs a local Docker
database, which this setup doesn't use.)

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

### Accounts and roles

Sign-in is **Supabase Auth (email + password)**. Each user has a row in `profiles` with a role,
and the database enforces it (migration `20261030090000_user_roles.sql`), whatever the screen shows:

| Role | Opens | Can |
|---|---|---|
| `kiosk` | `/kiosk` | `create_token`, `cancel_token`, `log_selection` |
| `driver` | `/bus` (their bus only) | `update_bus_location`, `adjust_occupancy`, arrive / end the trip: **own bus only** |
| `dispatcher` | `/dashboard` | approve / dismiss, Bus arrived, Reset bus, Recompute now |
| `viewer` | `/dashboard` | read only, no buttons |
| `admin` | everything + `/admin/users` | all of the above, Settings, Reset demo, change roles |

- **Signed out = nothing.** No table can be read and no function called with just the anon key.
- **New accounts** (Create one on `/login`) start as `viewer`; an admin gives them a role on
  `/admin/users` (a driver also gets a bus). Admins can't change their own role.
- **How it's checked:** `has_role()` / `drives_bus()` read `profiles`. Each business function is a
  thin `public` wrapper that checks the role and calls the original in the `private` schema, which
  the API can't reach. Calls without a login token (pg_cron, SQL editor, CLI) are trusted, so the
  every-minute dispatch and `supabase/tests/run.sh` keep working.
- **Kiosk:** signs in once as the kiosk account and stays signed in (the session is stored and
  refreshed by the browser). Its account and Sign out are in the debug drawer (press **D**).

**Demo accounts** (create once): Supabase → Authentication → Users → **Add user**, tick **Auto
confirm**, same password for all five:

| Email | Role |
|---|---|
| `admin@tapselect.demo` | admin |
| `dispatcher@tapselect.demo` | dispatcher |
| `driver@tapselect.demo` | driver (starts on `R2-01`; picks another bus on `/bus`) |
| `kiosk@tapselect.demo` | kiosk (also used by the simulator) |
| `viewer@tapselect.demo` | viewer |

They get their roles automatically on creation.

**Drivers pick their bus per shift.** On `/bus` a driver taps **Change bus** and picks any bus no
other driver holds (`choose_my_bus`; taken buses are greyed out via `taken_buses`). The database
then accepts that driver's GPS, seat corrections and arrival only for that bus. Changing bus stops
sharing location for the old one first. Admins can still assign a driver's bus on **Users**. Put that password in `DEMO_PASSWORD` and set
`NEXT_PUBLIC_DEMO_MODE=true` to show **Demo login as…** on `/login`; the panel signs in through
`/api/demo-login` on the server, so the password never reaches the browser.
`NEXT_PUBLIC_DEMO_ROLES` picks the buttons (enforced by the server route too): unset means kiosk,
dispatcher, driver and viewer. **Admin appears only if listed**; on a deployed site leave it out and
sign in as `admin@tapselect.demo` with the password. If Supabase's per-network sign-in limit is hit
(many people signing in at once), the page says so; the audience should use the Live board instead. In Supabase →
Authentication → Sign In / Providers, keep **Email** on and turn **Confirm email** off so
sign-ups work without email delivery.

> Demo mode lets anyone with the URL sign in as any role, admin included. Turn it off
> (`NEXT_PUBLIC_DEMO_MODE=false`) and change the demo password for anything beyond the demo.
> The service-role key is not used anywhere.

---

## Network simulator

`simulator/` adds passengers at `STOP-02`…`STOP-06` so the dashboard shows city-wide demand.
Node 21+, no dependencies, reads `apps/web/.env.local`. It signs in as the **kiosk** account
(`SIM_EMAIL`, default `kiosk@tapselect.demo`, with `SIM_PASSWORD` or `DEMO_PASSWORD`), so it has
exactly a kiosk's rights.

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

1. <https://vercel.com/new> → **Import** `Hemmy01/tap-and-select`.
2. **Root Directory:** `apps/web` (framework preset Next.js, other settings default).
3. **Environment Variables:** the `NEXT_PUBLIC_*` values from `apps/web/.env.local` and
   `DEMO_PASSWORD` (Production and Preview).
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
