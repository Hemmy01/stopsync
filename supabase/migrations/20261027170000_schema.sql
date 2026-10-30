-- StopSync core schema: stops, destinations, queue tokens, buses, events,
-- dispatch decisions and tunable config. See CLAUDE.md section 8.

create table public.stops (
  id   text primary key,
  name text not null,
  lat  double precision,
  lng  double precision
);

create table public.destinations (
  code         text primary key,
  name         text not null,
  route        text not null,
  bus_capacity int  not null default 70 check (bus_capacity > 0),
  sort_order   int  not null default 0
);

create table public.queue_tokens (
  id          bigint generated always as identity primary key,
  code        text not null,
  stop_id     text not null references public.stops(id),
  destination text not null references public.destinations(code),
  card_id     text,
  method      text not null check (method in ('voice','gesture','rfid','manual')),
  confidence  numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status      text not null default 'waiting'
                check (status in ('waiting','boarded','expired')),
  created_at  timestamptz not null default now(),
  boarded_at  timestamptz
);

-- One waiting token per card.
create unique index queue_tokens_one_waiting_per_card
  on public.queue_tokens (card_id) where status = 'waiting';
create index queue_tokens_dest_status_created
  on public.queue_tokens (destination, status, created_at);
create index queue_tokens_created on public.queue_tokens (created_at);

create table public.buses (
  id                  text primary key,
  destination         text not null references public.destinations(code),
  status              text not null default 'at_terminal'
                        check (status in ('at_terminal','on_the_way','arrived')),
  lat                 double precision,
  lng                 double precision,
  location_updated_at timestamptz,
  released_at         timestamptz,
  eta_minutes         int
);

create index buses_dest_status on public.buses (destination, status);

create table public.bus_events (
  id            bigint generated always as identity primary key,
  bus_id        text not null references public.buses(id),
  stop_id       text references public.stops(id),
  event         text not null check (event in ('released','arrived','reset')),
  source        text not null check (source in ('dashboard','gps','manual')),
  boarded_count int,
  created_at    timestamptz not null default now()
);

create index bus_events_created on public.bus_events (created_at);

create table public.dispatch_decisions (
  id              bigint generated always as identity primary key,
  destination     text not null references public.destinations(code),
  action          text not null check (action in ('release','hold')),
  reason          text not null,
  waiting         int not null,
  load_pct        numeric not null,
  oldest_wait_min numeric,
  status          text not null default 'pending'
                    check (status in ('pending','approved','dismissed','superseded')),
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);

create index dispatch_decisions_dest_status
  on public.dispatch_decisions (destination, status, created_at desc);

create table public.config (
  key         text primary key,
  value       numeric not null,
  description text
);
