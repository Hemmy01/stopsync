# StopSync

A smart bus stop prototype for Kigali: a **digital waiting list for buses**.
Built by a 5-person team in the CMU-Africa Bridge Program.

1. A passenger **taps a card** at the kiosk.
2. They choose their stop by **voice** or a **hand gesture** (ML models on an Arduino Nano 33 BLE Sense).
3. They confirm and get a **queue number** such as `R3-014`.
4. HQ sees live demand on a **dashboard**, gets a "release a bus" recommendation, and approves it.
5. The kiosk shows the **bus status and ETA**, updated from the driver's phone GPS.
6. When the bus arrives, waiting passengers are marked **boarded**.

**Sense** (who is waiting) → **Decide** (when to send a bus) → **Inform** (number and ETA).

```
Arduino board ──USB serial──▶ Kiosk page (Chrome, Web Serial)
                                   │
                                   ▼
                              Supabase (Postgres + Realtime + Cron)
                                   ▲                ▲
                    HQ dashboard ──┘                └── /bus page (phone GPS)
```

The board never talks to the internet; the kiosk page is the gateway. All business rules
(queue numbers, dispatch, boarding) live in Postgres functions, so every screen behaves the same.

| Screen | Path | Used on |
|---|---|---|
| Home | `/` | anywhere |
| Kiosk | `/kiosk` | laptop at the stop, Chrome, board plugged in by USB |
| HQ dashboard | `/dashboard` | desktop or tablet |
| Bus driver | `/bus` | phone in the bus (needs HTTPS for GPS) |

---

## Repository

```
apps/web/        Next.js app (kiosk, dashboard, bus page)
supabase/        migrations, seed and CLI config
docs/protocol.md Board ↔ kiosk serial protocol (for the firmware team)
simulator/       optional load simulator (not built yet)
firmware/ ml/    owned by teammates
```

Stack: Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4 · Supabase · Vitest.

---

## Run it locally

You need **Node.js 20.9 or newer** and **Chrome or Edge** (Web Serial only works there).

### 1. Clone and install

```bash
git clone https://github.com/Hemmy01/stopsync.git
cd stopsync/apps/web
npm install
```

### 2. Add environment values

Ask Danny for the project URL and anon key, then create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
NEXT_PUBLIC_STOP_ID=STOP-01
```

Use the **anon / publishable** key only. Never put the `service_role` or secret key in the web app.
`.env*` files are git-ignored; only `.env.example` is committed.

### 3. Start

```bash
npm run dev
```

Open <http://localhost:3000>. The database is already set up on the shared Supabase project,
so that's all a teammate needs.

### Try it without the board

Open <http://localhost:3000/kiosk?mock=1>, or press **D** on the kiosk. The debug drawer emits every
board message (`HELLO`, `STATE`, `SELECT` for each stop) through the same parser as real serial,
and shows the raw serial log.

### Connect the board

1. Flash a sketch that speaks the protocol in [`docs/protocol.md`](docs/protocol.md) (115200 baud).
2. Close the Arduino Serial Monitor (only one program can open the port).
3. On `/kiosk`, click **Connect board** and choose the Arduino. **Any port** lists every serial device.
4. After the first time, the kiosk reconnects by itself on reload and when the board is plugged back in.

---

## Commands (in `apps/web`)

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route types + `tsc --noEmit` |
| `npm test` | Vitest unit tests (protocol, kiosk reducer, ETA, dashboard, serial, GPS) |
| `npm run build` | Production build |
| `npm run check` | All of the above, in order (run before every commit) |

---

## Supabase

Everything in the database comes from `supabase/migrations/` and `supabase/seed.sql`.

| Table | Holds |
|---|---|
| `stops` | The kiosk location (`STOP-01`) |
| `destinations` | The four stops: NYA Nyabugogo (R1), REM Remera (R2), KIM Kimironko (R3), DTN Downtown (R4) |
| `queue_tokens` | Queue numbers and their status (`waiting` / `boarded` / `expired`) |
| `buses` | 2 buses per route, status, GPS, ETA |
| `bus_events` | Released / arrived / reset history |
| `dispatch_decisions` | Release / hold recommendations and HQ decisions |
| `config` | Tunable dispatch rules (editable on the dashboard) |

Functions: `create_token`, `run_dispatch` (every minute via **pg_cron**), `approve_decision`,
`dismiss_decision`, `update_bus_location`, `mark_bus_arrived`, `reset_bus`.

### Changing the schema (Danny)

Put the CLI values in a git-ignored `.env.local` at the repo root
(`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`; see `.env.example`), then:

```bash
set -a && . ./.env.local && set +a
npx supabase link --project-ref "$SUPABASE_PROJECT_REF" -p "$SUPABASE_DB_PASSWORD"
npx supabase migration new <name>          # write SQL in the new file
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
(`using (true) with check (true)`) for `anon`, and the business functions are `security definer`
and callable by `anon`. Anyone with the anon key can read and change data.
**Before any real use, add authentication and per-role policies** (e.g. only HQ can approve,
only a driver can move their bus).

---

## Network simulator

`simulator/` adds passengers at five more stops (`STOP-02`…`STOP-06`, created by migration
`20261027210000_simulator_stops.sql`) so the dashboard shows city-wide demand. It needs Node 21+,
has no dependencies and reads the public values from `apps/web/.env.local`.

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
- Tickets go through `create_token`, like the kiosk, with method `rfid` (card only). They count as
  demand on the dashboard and in dispatch, but stay out of "How passengers chose" and Model insights.
- The kiosk's departure strip counts only its own stop (`STOP-01`); the dashboard counts every stop.
- A bus arriving boards the oldest waiting passengers for its route across all stops.
  **Reset demo** on the dashboard clears everything.

## Deploy to Vercel

1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `apps/web` (framework preset: Next.js).
3. Add the three `NEXT_PUBLIC_*` variables from `apps/web/.env.local`.
4. Deploy. The phone needs this **https://** address for GPS on `/bus`.

---

## Demo script (about 5 minutes)

Setup: laptop with Chrome on `/kiosk` (board plugged in, or `?mock=1`), a second screen on
`/dashboard`, a phone on the deployed `/bus` URL.

1. **Kiosk:** click **Hold your card here** → *Demo card 1*. The board starts listening.
2. **Say "Kimironko"** (or show the gesture). The kiosk asks *Kimironko?* with "Heard by voice · 91%".
3. **Confirm.** The boarding-pass ticket shows `R3-001`, position in queue and *Waiting for dispatch*.
4. Tap *Demo card 1* again: *You're already in the queue*.
5. Add a few more tickets with other cards; watch the departure strip and dashboard counts rise live.
6. **Dashboard:** point out waiting counts, oldest wait, load bar and *How passengers chose* (the ML models in use).
   To trigger a release quickly, set **Release after waiting** to `0` in Settings and press **Recompute now**.
7. **Approve** the Kimironko release. The kiosk ticket and strip change to *R3-01 · 8 min*.
8. **Phone:** open `/bus`, pick **R3-01**, **Start sharing location**. Walk around: the ETA updates on the
   kiosk and dashboard. Near the stop it marks itself arrived, or press **I've arrived**.
9. Kiosk strip shows *Boarding*; the dashboard shows passengers boarded. Press **Reset bus**.
10. Set **Release after waiting** back to `15`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No **Connect board** button | Use Chrome or Edge on a laptop; Web Serial isn't available elsewhere. |
| "Couldn't open the board" | Close the Arduino Serial Monitor or any other tab using the port. |
| `/bus` says location only works over HTTPS | Open the deployed `https://` URL on the phone (plain `http://192.168…` won't work). |
| "Supabase is not configured" banner | Create `apps/web/.env.local` with the three values and restart `npm run dev`. |
| Recommendations never change | pg_cron runs `run_dispatch()` every minute; use **Recompute now** to run it immediately. |
