# StopSync: Project Context

This file is the source of truth for building StopSync's web app, database, firmware and ML.
Read it fully before writing code. If anything here conflicts with a request in chat, ask.

---

## 1. What StopSync is

StopSync is a smart bus stop prototype for Kigali, built by a 5-person team in the
CMU-Africa Bridge Program. It is a digital waiting list for buses:

1. A passenger **taps a card** at the bus stop kiosk.
2. They choose their destination stop by **voice** or by a **tap gesture** over the
   proximity sensor (recognised by ML models running on an Arduino Nano 33 BLE Sense Lite).
3. They confirm on screen and get a **queue number** (e.g. `R3-014`).
4. HQ sees live demand per destination on a **dashboard**, gets a
   "release a bus" recommendation, and approves it.
5. The kiosk shows the passenger the **bus status and ETA**.
6. When the bus arrives, waiting passengers are marked **boarded**.

Three jobs: **Sense** (count who is waiting) → **Decide** (when to send a bus) →
**Inform** (tell passengers their number and ETA).

I (Danny) own everything: web, database, Arduino firmware and the two ML models
(voice keyword spotting + tap gestures, trained in Edge Impulse).

---

## 2. Demo scope: what is real vs simulated

| Part | Status in this demo |
|---|---|
| Voice / tap-gesture destination choice | **Real**, two Edge Impulse models on the board, sent over USB serial. Until the models are exported, gestures use a rule-based detector (`GESTURE_RULE`) |
| Card tap (RFID) | **Simulated** on the kiosk page (future: real RC522 reader) |
| Kiosk screen | Real web page, Chrome on a laptop, board plugged in via USB |
| Database, dispatch rules, dashboard | Real (Supabase) |
| Bus location | A phone opening the `/bus` page and sharing GPS |
| Bus arrival | Dashboard button, or the `/bus` page "I've arrived" button (no bus-detection model) |
| Other stops / network load | Simulator script (`simulator/`, stops `STOP-02`…`STOP-06`) |

The kiosk must be fully usable **without the board** (mock mode), so web work never
waits on hardware.

---

## 3. Destinations (seed data)

Four destination stops for the demo (final). Codes are what the board sends.

| code | name | route | route colour token | voice label (say) | gesture label | gesture hint | board LED |
|---|---|---|---|---|---|---|---|
| REM | Remera | R2 | `--route-2` | `remera` | `one_tap` | Tap once | green |
| DTN | Downtown | R4 | `--route-4` | `downtown` | `two_taps` | Tap twice | purple |
| NYA | Nyabugogo | R1 | `--route-1` | `nyabugogo` | `three_taps` | Tap 3 times | blue |
| KIM | Kimironko | R3 | `--route-3` | `kimironko` | `hold` | Hold your hand still | yellow |

Non-selecting labels: voice `noise`, `unknown`; gesture `passing`, `idle`.
They never select anything.

> Keep the mapping only in: seed data (`destinations.voice_label/gesture_label/gesture_hint`),
> `apps/web/lib/destinations.ts` and `firmware/kiosk_node/config.h`. A Vitest test checks
> that config.h and destinations.ts agree.

Kiosk location: `STOP-01`, name "Kiosk 1 (Demo)", lat -1.9441, lng 30.0619.

Demo cards (simulated RFID): 5 cards, ids `CARD-01`…`CARD-05`,
labels "Demo card 1"…"Demo card 5".

---

## 4. Architecture

```
Arduino board (Edge Impulse models) ──USB serial──▶ Kiosk page (Chrome, Web Serial)
                                   │
                                   ▼
                              Supabase (Postgres + Realtime + Cron)
                                   ▲                ▲
                    HQ dashboard ──┘                └── /bus page (phone GPS)
```

- The board never talks to the internet. The kiosk page is the gateway.
- All screens update live via Supabase Realtime.
- Business rules (queue numbers, dispatch, boarding) live in **Postgres functions**,
  so every screen behaves the same way.

---

## 5. Tech stack and constraints

- **Next.js** (latest, App Router) + **TypeScript (strict)** + **Tailwind CSS**
  (whatever version `create-next-app` installs; define tokens the way that version expects)
- **@supabase/supabase-js** for data and Realtime
- **Supabase CLI** via `npx supabase` for migrations, seed and type generation
- **lucide-react** for icons; `clsx` allowed
- **Vitest** for small unit tests
- Fonts via `next/font/google`
- Web Serial API (Chrome/Edge only), `@types/w3c-web-serial` for types
- Deploy target: **Vercel** (root directory `apps/web`)
- Firmware: **arduino-cli**, FQBN `arduino:mbed_nano:nano33ble`, libraries `Arduino_APDS9960`
  (+ PDM from the core); models as **Edge Impulse Arduino library** zips in `ml/exports/`
- Data collection: **edge-impulse-cli** (`edge-impulse-data-forwarder`)

Do not add other dependencies without telling me why first.
No authentication in this prototype.

---

## 6. Repository structure

Monorepo. Every folder is in scope, including `firmware/` and `ml/`.

```
stopsync/
├── apps/web/                 Next.js app
│   ├── app/
│   │   ├── page.tsx          Home: links to the three screens
│   │   ├── kiosk/            Passenger kiosk
│   │   ├── dashboard/        HQ dashboard
│   │   └── bus/              Bus driver phone page
│   ├── components/
│   ├── lib/
│   │   ├── supabase.ts       Browser client
│   │   ├── database.types.ts Generated by Supabase CLI
│   │   ├── protocol.ts       Serial message types + parser
│   │   ├── serial.ts         Web Serial adapter + mock adapter
│   │   ├── destinations.ts   Single source for display config (colours, order)
│   │   └── eta.ts            ETA helper
│   ├── content/models.json   Model status/accuracy shown on dashboard and /about
│   └── tests/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
├── simulator/                Node script: extra stops at peak/off-peak rates
├── docs/                     protocol.md, architecture.md, demo-script.md, rehearsal-checklist.md
├── firmware/
│   ├── README.md             Build/upload, multi-model options, "When the models arrive"
│   └── kiosk_node/           kiosk_node.ino, config.h, protocol, led, gestures, voice
├── ml/
│   ├── collect/tap_logger/   20 Hz "prox,clear" stream for edge-impulse-data-forwarder
│   ├── exports/              Edge Impulse Arduino library zips
│   └── results/              voice.md, gestures.md
├── .env.example
└── README.md
```

---

## 7. Board ↔ kiosk serial protocol

USB serial, **115200 baud**, one message per line, `\n` terminated, comma-separated,
uppercase message type. Arduino USB vendor id is `0x2341`; offer it as a filter but
allow choosing any port.

**Board → kiosk**

| Message | Meaning |
|---|---|
| `HELLO,STOP-01` | Board started / connected |
| `STATE,LISTENING` | Board is listening for voice or gesture |
| `STATE,IDLE` | Board stopped listening |
| `SELECT,KIM,voice,0.91` | Passenger chose a destination: code, method (`voice` or `gesture`), confidence 0–1 |
| `LOG,<text>` | Diagnostics only (e.g. `LOG,voice=VOICE_OFF,gesture=GESTURE_RULE`). Shown in the debug drawer, never acted on |

**Kiosk → board**

| Message | Meaning |
|---|---|
| `START` | Card tapped, start listening. Also sent again when the passenger presses **Change** |
| `ACK,R3-014` | Queue number created |
| `CANCEL` | Passenger cancelled, timed out, or the card is already queued |

Rules:
- Ignore unknown or malformed lines (log them in the debug drawer, never crash).
- Ignore `SELECT` when the kiosk is not in the listening step.
- Accept `SELECT` only for known destination codes.
- The board sends at most one `SELECT` per `START`.
- Write `docs/protocol.md` from this section so teammates can follow it.

---

## 8. Database (Supabase)

All changes go through migrations in `supabase/migrations/`. Generate TypeScript types
into `apps/web/lib/database.types.ts` after every schema change.

### Tables

```sql
stops (
  id text primary key,                 -- 'STOP-01'
  name text not null,
  lat double precision,
  lng double precision
)

destinations (
  code text primary key,               -- 'KIM'
  name text not null,
  route text not null,                 -- 'R3'
  bus_capacity int not null default 70,
  sort_order int not null default 0
)

queue_tokens (
  id bigint generated always as identity primary key,
  code text not null,                  -- 'R3-014'
  stop_id text not null references stops(id),
  destination text not null references destinations(code),
  card_id text,                        -- simulated RFID card
  method text not null check (method in ('voice','gesture','rfid','manual')),
  confidence numeric,
  status text not null default 'waiting'
    check (status in ('waiting','boarded','expired')),
  created_at timestamptz not null default now(),
  boarded_at timestamptz
)
-- one waiting token per card
unique index on queue_tokens(card_id) where status = 'waiting'

buses (
  id text primary key,                 -- 'R3-07'
  destination text not null references destinations(code),
  status text not null default 'at_terminal'
    check (status in ('at_terminal','on_the_way','arrived')),
  lat double precision,
  lng double precision,
  location_updated_at timestamptz,
  released_at timestamptz,
  eta_minutes int
)

bus_events (
  id bigint generated always as identity primary key,
  bus_id text not null references buses(id),
  stop_id text references stops(id),
  event text not null check (event in ('released','arrived','reset')),
  source text not null check (source in ('dashboard','gps','manual')),
  boarded_count int,
  created_at timestamptz not null default now()
)

dispatch_decisions (
  id bigint generated always as identity primary key,
  destination text not null references destinations(code),
  action text not null check (action in ('release','hold')),
  reason text not null,
  waiting int not null,
  load_pct numeric not null,
  oldest_wait_min numeric,
  status text not null default 'pending'
    check (status in ('pending','approved','dismissed','superseded')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
)

config (
  key text primary key,
  value numeric not null,
  description text
)
```

Seed `config` with:
`release_load_pct = 70`, `max_wait_minutes = 15`, `default_eta_minutes = 8`,
`avg_bus_speed_kmh = 18`, `arrival_radius_m = 50`.

Seed 2 buses per destination (`R1-01`, `R1-02`, … `R4-02`), all `at_terminal`.

### v2 additions (new migrations only; never edit applied ones)

- `destinations`: columns `voice_label`, `gesture_label`, `gesture_hint` (filled from section 3).
  Any destination outside the final four (the old placeholder) moves to `DTN`, then is deleted.
- `selection_events (id, stop_id, destination, method voice|gesture|manual, confidence,
  outcome confirmed|changed|cancelled|timeout, token_code, created_at)`: permissive RLS, Realtime.
- `log_selection(p_stop, p_dest, p_method, p_conf, p_outcome, p_token)`: insert one event.
- `reset_demo()`: delete tokens, decisions, bus events and selection events; all buses `at_terminal`.
- View `model_insights_today` (`security_invoker = on`): per method, today in Kigali time:
  selections, confirmed, changed, cancelled+timeout, confirmation rate, avg confidence.
- Stops `STOP-02`…`STOP-06` (Kigali coordinates) for the simulator.

### Functions (all `security definer`, `set search_path = public`, granted to `anon`)

1. **`create_token(p_stop text, p_dest text, p_card text, p_method text, p_conf numeric) returns jsonb`**
   - If `p_card` already has a `waiting` token → return
     `{"status":"duplicate","code":"<existing>","destination":"<code>"}`.
   - Otherwise take a transaction advisory lock on the destination, build the next code
     `<route>-<NNN>` counting that destination's tokens for **today in Africa/Kigali time**,
     insert, and return `{"status":"created","code":"R3-014","destination":"KIM","position":<waiting position>}`.

2. **`run_dispatch() returns void`**: for each destination:
   - `waiting` = waiting tokens, `oldest_wait_min`, `load_pct = waiting / bus_capacity * 100`.
   - If a bus for that destination is `on_the_way` → no new decision.
   - `release` if `load_pct >= release_load_pct` **or** (`waiting > 0` and
     `oldest_wait_min >= max_wait_minutes`); otherwise `hold`.
   - Write a human reason, e.g. `"Load 72% ≥ 70%"` or `"Oldest wait 16 min ≥ 15 min"` or
     `"Low demand (3 waiting)"`.
   - Only insert a new row when the action differs from the latest `pending` decision
     for that destination; mark the old pending one `superseded`.

3. **`approve_decision(p_decision bigint) returns jsonb`**: mark it `approved`, pick an
   `at_terminal` bus for that destination, set it `on_the_way`, `released_at = now()`,
   `eta_minutes = default_eta_minutes`, log a `released` bus event. Return the bus id and ETA.
   If no bus is free, return an error status the dashboard can show.

4. **`dismiss_decision(p_decision bigint)`**: mark `dismissed`.

5. **`update_bus_location(p_bus text, p_lat double precision, p_lng double precision) returns jsonb`**:
   store the location; if the bus is `on_the_way`, recompute `eta_minutes` from distance to
   `STOP-01` (haversine) and `avg_bus_speed_kmh` (minimum 1); if within `arrival_radius_m`,
   call `mark_bus_arrived` with source `gps`.

6. **`mark_bus_arrived(p_bus text, p_source text default 'manual') returns jsonb`**:
   set the bus `arrived`, mark up to `bus_capacity` of the oldest `waiting` tokens for its
   destination as `boarded`, log an `arrived` event with `boarded_count`, return the count.

7. **`reset_bus(p_bus text)`**: back to `at_terminal`, clear ETA, log `reset`.

### Platform setup (in migrations)

- Enable RLS on every table with a permissive prototype policy for `anon` and
  `authenticated` (`using (true) with check (true)`). Note clearly in the README that this
  is prototype-only and production needs real auth.
- Add `queue_tokens`, `buses`, `dispatch_decisions`, `bus_events`, `config` to the
  `supabase_realtime` publication.
- Schedule `run_dispatch()` every minute with `pg_cron`
  (`create extension if not exists pg_cron`). If cron can't be enabled, tell me and rely on
  the dashboard's "Recompute now" button.

---

## 9. Pages and behaviour

### Shared
- Live clock in Kigali time (`Africa/Kigali`), 24-hour.
- Realtime subscriptions clean up on unmount.
- Friendly banners for: offline, Supabase error, board disconnected.
- Every async action shows a pending state and never double-submits.

### `/kiosk` (laptop, landscape ~1366×768, used at arm's length)

Layout: top bar · main stage · live departure strip.

- **Top bar:** StopSync wordmark, stop name, clock, board status pill
  (`Connected` / `Not connected` / `Mock mode`), "Connect board" button (Web Serial).
- **Departure strip (always visible):** one cell per destination: route badge, name,
  people waiting, and bus status ("Waiting for dispatch" / "R3-07 · 6 min" / "Boarding").

Main stage steps (a small state machine in one reducer):

1. **Idle:** "Tap your card to begin". A card-reader target area; clicking it opens the
   5 demo cards (label it subtly: "Simulated RFID"). Choosing a card → step 2 and send `START`.
   A small "How to choose your stop" sign shows the voice names and tap gestures.
2. **Listening:** "Say your stop or show a gesture". Show the 4 destinations as large
   tiles (route badge + name) and a calm listening indicator. Tiles are clickable as a
   fallback ("Tap a stop if I didn't catch it", method `manual`). Each tile shows the route
   badge, name, `Say "Remera"` and the gesture hint (`Tap once`).
   20-second timeout → send `CANCEL`, back to idle.
3. **Confirm:** "Kimironko?" with a method chip, e.g. "Heard by voice · 91%" or
   "Gesture · 88%". Buttons: **Confirm** / **Change** (back to listening and send `START` again).
   15-second timeout → cancel.
4. **Ticket:** the signature element (see design). Shows the code (`R3-014`), destination,
   position in queue, and a live status line that updates via Realtime
   ("Waiting for dispatch" → "Bus R3-07 is on the way · about 6 min" → "Your bus is here").
   Send `ACK,<code>` to the board. Auto-return to idle after 12 seconds.
5. **Already queued:** "You're already in the queue" with the existing ticket code; send `CANCEL`.

Every selection outcome (confirmed, changed, cancelled, timeout) is recorded with `log_selection`.

**Mock / debug mode** (`?mock=1` or press `D`): a drawer with the raw serial log and buttons
that emit `HELLO`, `STATE,LISTENING`, `STATE,IDLE`, `LOG,…` and
`SELECT,<code>,voice|gesture,<conf>` for every destination. Mock mode must exercise exactly the same code path as real serial.

### `/dashboard` (HQ, desktop-first, works on a tablet)

- **Header:** title, clock, totals (waiting now, boarded today, buses on the way),
  "Recompute now" button (calls `run_dispatch`), "Reset demo" (confirm dialog → `reset_demo`).
- **Destination cards (grid of 4):** route badge + name; waiting count (large);
  oldest wait; load bar (% of capacity, turns amber ≥ 70%); bus status;
  the pending recommendation with its reason and **Approve** / **Dismiss**;
  **Bus arrived** (when on the way) and **Reset bus** (when arrived).
- **How passengers chose (today):** a small horizontal stacked bar of
  voice / gesture / manual. This shows the ML models in use.
- **Model insights (today):** from `model_insights_today` (selections, confirmation rate,
  avg confidence per method) plus model status/accuracy from `apps/web/content/models.json`.
- **Activity feed:** newest first, live: tokens created, decisions, approvals, arrivals.
- **Settings:** edit the `config` values inline.

### `/bus` (phone, mobile-first)

- Pick a bus from the list.
- **Start sharing location** / **Stop**: `navigator.geolocation.watchPosition`, sending
  `update_bus_location` at most every 5 seconds. Show last sent time and accuracy.
- Big **"I've arrived"** button (calls `mark_bus_arrived` with source `manual`).
- Clear message if location permission is denied (and note that HTTPS is required).

### `/` (home)

Minimal: project name, one-line description, three links (Kiosk, Dashboard, Bus) and a link to About.

### `/about` (for judges, printable)

Problem in one line; Sense → Decide → Inform; what runs where (board / browser / cloud);
real vs simulated; both models (labels, status, accuracy from `models.json`); hardware;
future upgrades (RC522 RFID + Tap&Go, camera module for finger gestures, LTE + solar kiosk,
operator GPS).

---

## 10. Design

Goal: **simple, clean and unique.** It should feel like well-designed public transport
signage, not a generic SaaS template.

**Concept: "Kigali departure board".** Calm paper-like background, strong ink-black type,
route colours used the way transit maps use them (functional, never decorative), and
tabular numbers everywhere times and counts appear.

**Tokens** (CSS variables; one place):
- `--paper` #F5F3EE (background) · `--surface` #FFFFFF · `--ink` #111418 ·
  `--muted` #5F6672 · `--line` #E3E0D8
- `--accent` #0B7A5F (primary actions, "connected", success)
- `--warn` #C98A00 · `--danger` #C2413B
- Route colours: `--route-1` #2B6CE4 · `--route-2` #0E9F6E · `--route-3` #E2611A ·
  `--route-4` #7B4FD6
- Radius 12px (cards), 999px (pills). Borders 1px `--line`. Almost no shadows.
- Spacing on an 8px scale.

**Type:**
- Display/headings: **Space Grotesk** (600–700)
- Body/UI: **Manrope** (400–600)
- Numbers, codes, times: **JetBrains Mono** with tabular figures
- Kiosk is read from about 60 cm away: base 20px, headings 40–56px, ticket code 96px+.

**Signature elements:**
- **Ticket card:** a boarding-pass style card with a perforated edge (CSS notches),
  the route colour as a left band, the code in huge mono type.
- **Route badge:** a rounded square in the route colour with the route id in white mono
  (`R3`), used consistently on every screen.
- **Departure strip:** a quiet row of cells like an airport board; numbers change with a
  brief, subtle transition.

**Rules:**
- No gradients, glassmorphism, neon, emoji, stock illustrations or centered gradient-text heroes.
- One clear primary action per screen.
- Touch targets ≥ 56px on the kiosk.
- WCAG AA contrast; never rely on colour alone (always pair with text or a badge).
- Motion 150–250ms, ease-out, and respect `prefers-reduced-motion`.
- Icons from lucide-react only, used sparingly.

---

## 11. Engineering conventions

- TypeScript strict, no `any`. Small, named components. Business logic in `lib/`, not in JSX.
- Kiosk step logic in a single typed reducer; protocol parsing in `lib/protocol.ts` (pure, tested).
- Use the generated Supabase types for every query and RPC.
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_STOP_ID=STOP-01`. Commit `.env.example` only.
- **Never** commit `.env*` files, print secrets in logs, or put the service role key in the web app.
- Tests (Vitest): protocol parser (incl. `LOG`), ETA/haversine helper, kiosk reducer
  transitions (incl. Change → `START`), config.h ↔ destinations.ts consistency.
- Before every commit: `npm run lint`, typecheck, tests, and `npm run build` must pass;
  firmware changes must also pass `arduino-cli compile` for every config that doesn't need the model zips.
- Firmware: non-blocking loop, 115200 baud, line-based serial, build switches in `config.h`.

**Git:**
- Never commit directly to `main`. One branch per phase, e.g. `feat/db-schema`,
  `feat/web-foundation`, `feat/kiosk`, `feat/web-serial`, `feat/dashboard`, `feat/bus-page`.
- Conventional Commits with scopes `web`, `db`, `fw`, `ml`, `docs`, `sim`, `chore`:
  `feat(db): add create_token function`, `feat(web): add kiosk ticket screen`.
- Small commits at each working step. Push the branch and open a PR when a phase is done
  (use `gh` if available, otherwise tell me).

---

## 12. Build phases and acceptance criteria

Work phase by phase. At the end of each phase: run the checks, commit, summarise what's
done, and tell me anything I need to do.

**Phase 0: Setup check**
- Confirm the repo layout, Node version and Supabase CLI availability.
- Ask me for any missing values from section 13. Do not guess credentials.

**Phase 1: Database**
- `supabase init` (if needed), link the project, write migrations + seed, push, generate types.
- ✅ Calling `create_token` twice with the same card returns `created` then `duplicate`.
- ✅ `run_dispatch` writes a sensible decision for each destination.
- ✅ approve → arrived → reset works end to end with SQL calls.

**Phase 2: Web foundation**
- Next.js app in `apps/web`, design tokens, fonts, shared layout, Supabase client, home page.
- ✅ Builds cleanly; home page matches the design rules.

**Phase 3: Kiosk (mock mode)**
- All five steps, departure strip, timeouts, duplicate handling, Realtime ticket status.
- ✅ Full passenger journey works using only the mock drawer.

**Phase 4: Web Serial**
- Real port connection, line parsing, `START`/`ACK`/`CANCEL` sending, reconnect handling.
- ✅ Works with an Arduino printing protocol lines; mock mode still works.

**Phase 5: Dashboard**
- Cards, recommendations, approve/dismiss, arrival/reset, method breakdown, feed, settings.
- ✅ Approving on the dashboard updates the kiosk ticket and departure strip live.

**Phase 6: Bus page**
- GPS sharing, ETA updates, auto-arrival in radius, manual arrival.
- ✅ Moving the phone updates ETA on kiosk and dashboard.

**Phase 7: Polish and docs**
- Empty/error/loading states, keyboard focus states, README (setup, env, Supabase,
  Vercel, demo script), `docs/protocol.md`.
- ✅ A teammate can clone, add env values and run it from the README alone.

**Phase 8: Simulator** → superseded by Phase H below.

### v2 phases (models on the board)

Goal: by the time the models are exported, board ↔ kiosk, firmware, deployment and testing
are done, so plugging the models in takes minutes.

- **A Audit:** repo vs every phase; tool check; report, then continue.
- **B Core:** finish any incomplete work from phases 1–7.
- **C Data:** destination labels, `selection_events`, `log_selection`, `reset_demo`,
  `model_insights_today`; no trace of the old placeholder destination anywhere.
- **D Kiosk + protocol:** `LOG`, Change → `START`, Already queued → `CANCEL`, tile hints,
  idle "How to choose" sign, `log_selection` for every outcome, drawer `STATE,IDLE` + `LOG`.
- **E Firmware** (`firmware/kiosk_node/`): switches `VOICE_MODE` (`VOICE_MODEL|VOICE_OFF`) and
  `GESTURE_MODE` (`GESTURE_MODEL|GESTURE_RULE|GESTURE_OFF`); boot `HELLO,STOP-01` +
  `LOG,voice=…,gesture=…`; states IDLE (LED off) → LISTENING (blue breathing) → WAIT_ACK
  (route colour) → IDLE (green pulse on ACK); timeouts 25 s LISTENING, 30 s WAIT_ACK; one
  SELECT per START; LED active LOW. Rule gestures: tap = near→away ≤ 600 ms, gap < 700 ms
  groups taps, group closes after 900 ms quiet, hold = near ≥ 1.8 s, confidence 1.00.
  Voice model: continuous mic, only while LISTENING, stop label ≥ 0.80 for 2 windows.
  Gesture model: prox + clear at 20 Hz, 3 s ring buffer, classify every 250 ms, ≥ 0.80 twice.
  `ml/collect/tap_logger/` streams `prox,clear` at 20 Hz. Ask before uploading.
  Done when: real board + kiosk work with `GESTURE_RULE` (tap twice → "Downtown?" → ticket).
- **F Model-drop checklist:** firmware/README "When the models arrive", `ml/results/*.md`,
  `apps/web/content/models.json`.
- **G Dashboard + About:** Reset demo, Model insights panel, `/about` page.
- **H Simulator:** stops `STOP-02`…`STOP-06` + Node script (start/stop, speed).
- **I Deploy + test:** Vercel, config.h consistency test, `docs/architecture.md` (Mermaid),
  `docs/demo-script.md`, `docs/rehearsal-checklist.md`, README, full pass/fail run.

---

## 13. What Danny provides

- Supabase **project ref**, **database password**, **personal access token** (for the CLI)
- Supabase **project URL** and **anon key** (for `.env.local`)
- Edge Impulse model exports (Arduino library zips) into `ml/exports/`
- The board on USB when firmware needs uploading (and the serial port closed elsewhere)
- Later: Vercel access for deployment

Ask before: installs, uploading firmware, deleting data outside `reset_demo`, resetting or
dropping database objects, changing the schema in ways not described here, or adding dependencies.
