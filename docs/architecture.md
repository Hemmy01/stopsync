# Tap&Select architecture

## What runs where

```mermaid
flowchart LR
  subgraph Board["Board: Nano 33 BLE Sense Lite (no internet)"]
    MIC[PDM microphone] --> VOICE[Voice model<br/>Edge Impulse]
    PROX[APDS9960 proximity] --> GEST[Tap rules or<br/>gesture model]
    VOICE --> SM[kiosk_node<br/>state machine]
    GEST --> SM
    SM --> LED[RGB LED]
  end

  subgraph Browser["Browsers (Next.js on Vercel)"]
    KIOSK["/kiosk<br/>Chrome + Web Serial"]
    DASH["/dashboard<br/>HQ"]
    BUS["/bus<br/>driver phone GPS"]
    ABOUT["/about"]
  end

  subgraph Cloud["Supabase"]
    PG[(Postgres<br/>tables + SQL functions)]
    RT[Realtime]
    CRON[pg_cron<br/>run_dispatch every minute]
  end

  SIM[simulator/<br/>STOP-02…06] -->|create_token| PG
  SM <-->|USB serial 115200<br/>START · ACK · CANCEL / SELECT · STATE · LOG| KIOSK
  KIOSK -->|create_token · log_selection| PG
  DASH -->|approve · dismiss · arrived · reset · config · reset_demo| PG
  BUS -->|update_bus_location · mark_bus_arrived| PG
  CRON --> PG
  PG --> RT
  RT -->|live changes| KIOSK
  RT --> DASH
  RT --> BUS
```

- The board never talks to the internet; the kiosk page is its gateway.
- Every business rule (queue numbers, dispatch, ETA, boarding) is a Postgres function, so all
  screens behave the same and the simulator uses the same path as the kiosk.
- Screens never poll: they reload their data when Realtime reports a change.

## A passenger's journey

```mermaid
sequenceDiagram
  actor P as Passenger
  participant K as Kiosk page
  participant B as Board
  participant DB as Supabase
  participant HQ as Dashboard
  participant D as Driver phone

  P->>K: tap card (simulated RFID)
  K->>DB: already waiting? (find token by card)
  K->>B: START
  B-->>K: STATE,LISTENING
  P->>B: "Downtown" or tap twice
  B-->>K: SELECT,DTN,gesture,1.00
  B-->>K: STATE,IDLE
  K->>P: "Downtown?"
  alt Change
    P->>K: Change
    K->>DB: log_selection(changed)
    K->>B: START (listen again)
  else Confirm
    P->>K: Confirm
    K->>DB: create_token → R4-007, position 3
    K->>DB: log_selection(confirmed)
    K->>B: ACK,R4-007 (green pulse)
  end
  DB-->>HQ: Realtime: new ticket
  Note over DB: pg_cron: run_dispatch() → "Release a bus"
  HQ->>DB: approve_decision → bus R4-01 on the way
  DB-->>K: Realtime: "R4-01 · 8 min"
  D->>DB: update_bus_location (every 5 s)
  DB-->>K: ETA updates
  D->>DB: within 50 m → mark_bus_arrived (gps)
  DB-->>K: "Your bus is here" · passengers boarded
```

## Board state machine

```mermaid
stateDiagram-v2
  [*] --> IDLE
  IDLE --> LISTENING: START
  LISTENING --> WAIT_ACK: confident voice/gesture<br/>(send SELECT, STATE IDLE)
  LISTENING --> IDLE: CANCEL · ACK · 25 s
  WAIT_ACK --> IDLE: ACK (green pulse)
  WAIT_ACK --> LISTENING: START (Change)
  WAIT_ACK --> IDLE: CANCEL · 30 s
  note right of LISTENING: LED blue, breathing
  note right of WAIT_ACK: LED in the route colour
```

## Kiosk steps

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> checking: card tapped
  checking --> listening: card free (send START)
  checking --> duplicate: already waiting (send CANCEL)
  listening --> confirm: board SELECT or tile tap
  listening --> idle: 20 s / Cancel (send CANCEL)
  confirm --> listening: Change (send START)
  confirm --> submitting: Confirm
  confirm --> idle: 15 s / Cancel (send CANCEL)
  submitting --> ticket: created (send ACK)
  submitting --> duplicate: duplicate (send CANCEL)
  submitting --> confirm: error (retry)
  ticket --> idle: 12 s / Done
  duplicate --> idle: 12 s / Done
```

Source: `apps/web/lib/kiosk-machine.ts` (`kioskReducer` + `transitionEffects`, both unit-tested).
