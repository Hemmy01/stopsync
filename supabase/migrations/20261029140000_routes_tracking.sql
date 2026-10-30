-- Routes, stops and live tracking (Phase 2 of the judges' feedback round).
--   routes_stops   each route's stops in order, terminal (0) to the kiosk (last)
--   terminals      where each route's buses wait, with a departure radius
--   bus_positions  GPS history, kept 24 h
-- update_bus_location now stores history, works out the next stop, stops remaining and
-- distance/ETA along the route, logs "departed" when a released bus leaves its terminal,
-- and still marks the bus arrived inside the kiosk's arrival radius.
-- Coordinates are approximate (agreed 2026-10-29); distances are straight lines between stops.

-- 1. Stops -------------------------------------------------------------------
-- STOP-02…06 (simulator stops) are the terminals; STOP-07…17 are new.
insert into public.stops (id, name, lat, lng) values
  ('STOP-07', 'Gakinjiro',          -1.9426, 30.0522),
  ('STOP-08', 'Muhima',             -1.9437, 30.0571),
  ('STOP-09', 'Gishushu',           -1.9509, 30.0998),
  ('STOP-10', 'Kimihurura',         -1.9508, 30.0818),
  ('STOP-11', 'Kiyovu',             -1.9478, 30.0700),
  ('STOP-12', 'Kibagabaga',         -1.9372, 30.1150),
  ('STOP-13', 'Kacyiru',            -1.9386, 30.0890),
  ('STOP-14', 'Kinamba',            -1.9366, 30.0652),
  ('STOP-15', 'Nyamirambo Stadium', -1.9741, 30.0478),
  ('STOP-16', 'Biryogo',            -1.9618, 30.0560),
  ('STOP-17', 'Kigali City Market', -1.9488, 30.0604)
on conflict (id) do update
  set name = excluded.name, lat = excluded.lat, lng = excluded.lng;

-- 2. Route stops -------------------------------------------------------------
create table public.routes_stops (
  route                    text not null,            -- 'R2' (destinations.route)
  stop_id                  text not null references public.stops(id),
  seq                      int  not null check (seq >= 0),  -- 0 = terminal
  distance_from_terminal_m int  not null check (distance_from_terminal_m >= 0),
  primary key (route, seq),
  unique (route, stop_id)
);

insert into public.routes_stops (route, stop_id, seq, distance_from_terminal_m) values
  ('R1', 'STOP-02', 0,    0), ('R1', 'STOP-07', 1,  914), ('R1', 'STOP-08', 2, 1473),
  ('R1', 'STOP-01', 3, 2008),
  ('R2', 'STOP-03', 0,    0), ('R2', 'STOP-09', 1, 1272), ('R2', 'STOP-05', 2, 2129),
  ('R2', 'STOP-10', 3, 3353), ('R2', 'STOP-11', 4, 4706), ('R2', 'STOP-01', 5, 5696),
  ('R3', 'STOP-04', 0,    0), ('R3', 'STOP-12', 1, 1832), ('R3', 'STOP-13', 2, 4726),
  ('R3', 'STOP-14', 3, 7380), ('R3', 'STOP-01', 4, 8291),
  ('R4', 'STOP-06', 0,    0), ('R4', 'STOP-15', 1,  707), ('R4', 'STOP-16', 2, 2351),
  ('R4', 'STOP-17', 3, 3877), ('R4', 'STOP-01', 4, 4425);

-- 3. Terminals ---------------------------------------------------------------
create table public.terminals (
  id       text primary key,                          -- 'T-R2'
  route    text not null unique,
  stop_id  text not null references public.stops(id), -- the route's seq 0 stop
  name     text not null,
  lat      double precision not null,
  lng      double precision not null,
  radius_m int not null default 150 check (radius_m > 0)
);

insert into public.terminals (id, route, stop_id, name, lat, lng)
select 'T-' || rs.route, rs.route, s.id, s.name, s.lat, s.lng
  from public.routes_stops rs
  join public.stops s on s.id = rs.stop_id
 where rs.seq = 0;

-- 4. Position history (kept 24 h) --------------------------------------------
create table public.bus_positions (
  id          bigint generated always as identity primary key,
  bus_id      text not null references public.buses(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  speed       double precision,   -- m/s from the phone, when it knows
  accuracy    double precision,   -- metres
  recorded_at timestamptz not null default now()
);
create index bus_positions_bus_time on public.bus_positions (bus_id, recorded_at desc);

create or replace function public.prune_bus_positions()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from bus_positions where recorded_at < now() - interval '24 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

select cron.schedule('stopsync-prune-bus-positions', '17 * * * *', 'select public.prune_bus_positions()');

-- 5. Live progress on buses, and the "departed" event -------------------------
alter table public.buses
  add column departed_at          timestamptz,
  add column last_stop_id         text references public.stops(id),  -- last stop passed
  add column next_stop_id         text references public.stops(id),
  add column stops_remaining      int,   -- stops left including the kiosk; null = off route
  add column distance_remaining_m int;

alter table public.bus_events drop constraint bus_events_event_check;
alter table public.bus_events add constraint bus_events_event_check
  check (event in ('released', 'departed', 'arrived', 'reset'));

insert into public.config (key, value, description) values
  ('off_route_m', 500, 'GPS further than this from the route: ETA falls back to a straight line to the kiosk')
on conflict (key) do nothing;

-- 6. Where along its route a point is ----------------------------------------
-- Projects the point onto each leg (local flat-earth metres, fine at city scale) and
-- keeps the closest leg. progress_m is measured from the terminal.
create or replace function public.route_progress(
  p_route text, p_lat double precision, p_lng double precision
)
returns table (progress_m double precision, off_route_m double precision)
language plpgsql
stable
set search_path = public
as $$
declare
  v_m_lat constant double precision := 110574;
  v_m_lng double precision := 111320 * cos(radians(p_lat));
  leg record;
  v_dx double precision; v_dy double precision;
  v_px double precision; v_py double precision;
  v_len2 double precision; v_t double precision; v_off double precision;
begin
  off_route_m := null;
  for leg in
    select a.distance_from_terminal_m as d0, b.distance_from_terminal_m as d1,
           sa.lat as lat0, sa.lng as lng0, sb.lat as lat1, sb.lng as lng1
      from routes_stops a
      join routes_stops b on b.route = a.route and b.seq = a.seq + 1
      join stops sa on sa.id = a.stop_id
      join stops sb on sb.id = b.stop_id
     where a.route = p_route
  loop
    v_dx := (leg.lng1 - leg.lng0) * v_m_lng;
    v_dy := (leg.lat1 - leg.lat0) * v_m_lat;
    v_px := (p_lng - leg.lng0) * v_m_lng;
    v_py := (p_lat - leg.lat0) * v_m_lat;
    v_len2 := v_dx * v_dx + v_dy * v_dy;
    v_t := case when v_len2 = 0 then 0 else greatest(0, least(1, (v_px * v_dx + v_py * v_dy) / v_len2)) end;
    v_off := sqrt(power(v_px - v_t * v_dx, 2) + power(v_py - v_t * v_dy, 2));
    if off_route_m is null or v_off < off_route_m then
      off_route_m := v_off;
      progress_m := leg.d0 + v_t * (leg.d1 - leg.d0);
    end if;
  end loop;
  if off_route_m is not null then
    return next;
  end if;
end;
$$;

-- 7. update_bus_location with history, progress and departure -----------------
create or replace function public.update_bus_location(
  p_bus text, p_lat double precision, p_lng double precision,
  p_speed double precision, p_accuracy double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bus       buses%rowtype;
  v_route     text;
  v_terminal  terminals%rowtype;
  v_kiosk     stops%rowtype;
  v_speed     numeric := greatest(config_value('avg_bus_speed_kmh', 18), 1);
  v_radius    numeric := config_value('arrival_radius_m', 50);
  v_off_limit numeric := config_value('off_route_m', 500);
  v_total_m   int;
  v_kiosk_m   double precision;
  v_progress  double precision;
  v_off       double precision;
  v_remaining double precision;
  v_next      text;
  v_last      text;
  v_left      int;
  v_eta       int;
  v_departed  boolean := false;
begin
  update buses
     set lat = p_lat, lng = p_lng, location_updated_at = now()
   where id = p_bus
  returning * into v_bus;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'Bus not found');
  end if;

  insert into bus_positions (bus_id, lat, lng, speed, accuracy)
  values (p_bus, p_lat, p_lng, p_speed, p_accuracy);

  if v_bus.status <> 'on_the_way' then
    return jsonb_build_object('status', 'stored', 'bus_status', v_bus.status);
  end if;

  select route into v_route from destinations where code = v_bus.destination;
  select * into v_terminal from terminals where route = v_route;

  -- Released bus leaving its terminal for the first time.
  if v_bus.departed_at is null and v_terminal.id is not null
     and haversine_m(p_lat, p_lng, v_terminal.lat, v_terminal.lng) > v_terminal.radius_m then
    update buses set departed_at = now() where id = p_bus;
    insert into bus_events (bus_id, stop_id, event, source)
    values (p_bus, v_terminal.stop_id, 'departed', 'gps');
    v_departed := true;
  end if;

  select * into v_kiosk from stops where id = kiosk_stop_id();
  v_kiosk_m := haversine_m(p_lat, p_lng, v_kiosk.lat, v_kiosk.lng);
  if v_kiosk_m <= v_radius then
    return mark_bus_arrived(p_bus, 'gps')
      || jsonb_build_object('distance_m', round(v_kiosk_m::numeric), 'departed', v_departed);
  end if;

  select rp.progress_m, rp.off_route_m into v_progress, v_off from route_progress(v_route, p_lat, p_lng) rp;
  select distance_from_terminal_m into v_total_m
    from routes_stops where route = v_route and stop_id = kiosk_stop_id();

  if v_progress is not null and v_total_m is not null and v_off <= v_off_limit then
    v_remaining := greatest(v_total_m - v_progress, 0);
    select stop_id into v_next from routes_stops
     where route = v_route and distance_from_terminal_m > v_progress order by seq limit 1;
    select stop_id into v_last from routes_stops
     where route = v_route and distance_from_terminal_m <= v_progress order by seq desc limit 1;
    select count(*) into v_left from routes_stops
     where route = v_route and distance_from_terminal_m > v_progress;
  else
    -- Off the route (or no route data): straight line to the kiosk, as before.
    v_remaining := v_kiosk_m;
  end if;

  v_eta := greatest(ceil(v_remaining / 1000 / v_speed * 60)::int, 1);
  update buses
     set eta_minutes = v_eta, next_stop_id = v_next, last_stop_id = v_last,
         stops_remaining = v_left, distance_remaining_m = round(v_remaining)::int
   where id = p_bus;

  return jsonb_build_object(
    'status', 'on_the_way',
    'distance_m', round(v_remaining::numeric),
    'eta_minutes', v_eta,
    'on_route', v_left is not null,
    'next_stop', v_next,
    'last_stop', v_last,
    'stops_remaining', v_left,
    'departed', v_departed
  );
end;
$$;

-- The original three-argument call keeps working (older /bus pages).
create or replace function public.update_bus_location(
  p_bus text, p_lat double precision, p_lng double precision
)
returns jsonb
language sql
security definer
set search_path = public
as $$ select public.update_bus_location(p_bus, p_lat, p_lng, null::double precision, null::double precision) $$;

-- 8. Clear progress when a bus arrives or is reset ----------------------------
create or replace function public.mark_bus_arrived(p_bus text, p_source text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bus      buses%rowtype;
  v_capacity int;
  v_count    int;
begin
  if p_source not in ('dashboard', 'gps', 'manual') then
    return jsonb_build_object('status', 'error', 'message', 'Unknown source');
  end if;

  select * into v_bus from buses where id = p_bus for update;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'Bus not found');
  end if;
  if v_bus.status = 'arrived' then
    return jsonb_build_object('status', 'already_arrived', 'bus_id', p_bus, 'boarded_count', 0);
  end if;

  select bus_capacity into v_capacity from destinations where code = v_bus.destination;

  with boarding as (
    select id from queue_tokens
     where destination = v_bus.destination and status = 'waiting'
     order by created_at, id
     limit v_capacity
     for update skip locked
  )
  update queue_tokens
     set status = 'boarded', boarded_at = now()
   where id in (select id from boarding);
  get diagnostics v_count = row_count;

  update buses
     set status = 'arrived', eta_minutes = null, next_stop_id = null, last_stop_id = kiosk_stop_id(),
         stops_remaining = 0, distance_remaining_m = 0
   where id = p_bus;

  insert into bus_events (bus_id, stop_id, event, source, boarded_count)
  values (p_bus, kiosk_stop_id(), 'arrived', p_source, v_count);

  return jsonb_build_object('status', 'arrived', 'bus_id', p_bus, 'boarded_count', v_count);
end;
$$;

create or replace function public.reset_bus(p_bus text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update buses
     set status = 'at_terminal', eta_minutes = null, released_at = null, departed_at = null,
         last_stop_id = null, next_stop_id = null, stops_remaining = null, distance_remaining_m = null
   where id = p_bus;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'Bus not found');
  end if;

  insert into bus_events (bus_id, stop_id, event, source)
  values (p_bus, kiosk_stop_id(), 'reset', 'dashboard');

  return jsonb_build_object('status', 'reset', 'bus_id', p_bus);
end;
$$;

create or replace function public.reset_demo()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tokens    int;
  v_decisions int;
  v_events    int;
  v_selection int;
begin
  delete from bus_events where true;
  get diagnostics v_events = row_count;
  delete from dispatch_decisions where true;
  get diagnostics v_decisions = row_count;
  delete from selection_events where true;
  get diagnostics v_selection = row_count;
  delete from queue_tokens where true;
  get diagnostics v_tokens = row_count;
  delete from bus_positions where true;

  update buses
     set status = 'at_terminal', eta_minutes = null, released_at = null, departed_at = null,
         lat = null, lng = null, location_updated_at = null,
         last_stop_id = null, next_stop_id = null, stops_remaining = null, distance_remaining_m = null
   where true;

  return jsonb_build_object(
    'status', 'reset',
    'tokens', v_tokens,
    'decisions', v_decisions,
    'bus_events', v_events,
    'selection_events', v_selection
  );
end;
$$;

-- 9. Platform: RLS, Realtime, grants ------------------------------------------
-- PROTOTYPE ONLY, like every other table (see 20261027170200_platform.sql).
do $$
declare
  t text;
begin
  foreach t in array array['routes_stops', 'terminals', 'bus_positions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy prototype_open_access on public.%I
         for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end;
$$;

revoke execute on function
  public.update_bus_location(text, double precision, double precision, double precision, double precision),
  public.route_progress(text, double precision, double precision),
  public.prune_bus_positions()
from public;

grant execute on function
  public.update_bus_location(text, double precision, double precision, double precision, double precision),
  public.route_progress(text, double precision, double precision)
to anon, authenticated;
