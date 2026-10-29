-- Seats and occupancy (Phase 4 of the judges' feedback round). Decisions agreed 2026-10-29:
--   * every bus: 40 seats + 30 standing (70, the old bus_capacity), occupancy starts at 0
--   * boarding at the kiosk adds the boarded count, capped at the bus's free places
--   * riders get off at the end of the line, back at the route's terminal: their tokens become
--     'completed' and occupancy drops (GPS in the terminal radius, the driver, or HQ's Reset bus)
--   * the driver can correct occupancy with - / +, logged as an 'occupancy' event
--   * dispatch uses free places: load = waiting not covered by buses already on the way
--     ÷ free places on the next bus, so a full bus on the way can trigger a second release

-- 1. Columns -------------------------------------------------------------------
alter table public.buses
  add column seats     int not null default 40 check (seats >= 0),
  add column standing  int not null default 30 check (standing >= 0),
  add column occupancy int not null default 0  check (occupancy >= 0);

alter table public.queue_tokens
  add column bus_id       text references public.buses(id),  -- the bus they boarded
  add column completed_at timestamptz;

alter table public.queue_tokens drop constraint queue_tokens_status_check;
alter table public.queue_tokens add constraint queue_tokens_status_check
  check (status in ('waiting', 'boarded', 'completed', 'expired'));

create index queue_tokens_on_bus on public.queue_tokens (bus_id) where status = 'boarded';

alter table public.bus_events
  add column delta     int,   -- 'occupancy': the driver's correction (+1 / -1)
  add column occupancy int;   -- occupancy after the event

alter table public.bus_events drop constraint bus_events_event_check;
alter table public.bus_events add constraint bus_events_event_check
  check (event in ('released', 'departed', 'arrived', 'completed', 'occupancy', 'reset'));

-- Free places on a bus (seats + standing - on board), never negative.
create or replace function public.bus_free_places(b public.buses)
returns int
language sql
immutable
set search_path = public
as $$ select greatest(b.seats + b.standing - b.occupancy, 0) $$;

-- 2. Boarding at the kiosk: capped at free places, adds to occupancy --------------
create or replace function public.mark_bus_arrived(p_bus text, p_source text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bus   buses%rowtype;
  v_free  int;
  v_count int;
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

  v_free := bus_free_places(v_bus);

  with boarding as (
    select id from queue_tokens
     where destination = v_bus.destination and status = 'waiting'
     order by created_at, id
     limit v_free
     for update skip locked
  )
  update queue_tokens
     set status = 'boarded', boarded_at = now(), bus_id = p_bus
   where id in (select id from boarding);
  get diagnostics v_count = row_count;

  update buses
     set status = 'arrived', eta_minutes = null, next_stop_id = null, last_stop_id = kiosk_stop_id(),
         stops_remaining = 0, distance_remaining_m = 0, occupancy = occupancy + v_count
   where id = p_bus
  returning * into v_bus;

  insert into bus_events (bus_id, stop_id, event, source, boarded_count, occupancy)
  values (p_bus, kiosk_stop_id(), 'arrived', p_source, v_count, v_bus.occupancy);

  return jsonb_build_object(
    'status', 'arrived', 'bus_id', p_bus, 'boarded_count', v_count,
    'occupancy', v_bus.occupancy, 'free_places', bus_free_places(v_bus)
  );
end;
$$;

-- 3. Back at the terminal: riders complete, the bus is ready again ----------------
create or replace function public.complete_trip(p_bus text, p_source text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bus      buses%rowtype;
  v_terminal text;
  v_count    int;
begin
  if p_source not in ('dashboard', 'gps', 'manual') then
    return jsonb_build_object('status', 'error', 'message', 'Unknown source');
  end if;

  select * into v_bus from buses where id = p_bus for update;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'Bus not found');
  end if;

  update queue_tokens
     set status = 'completed', completed_at = now()
   where bus_id = p_bus and status = 'boarded';
  get diagnostics v_count = row_count;

  update buses
     set status = 'at_terminal', eta_minutes = null, released_at = null, departed_at = null,
         last_stop_id = null, next_stop_id = null, stops_remaining = null, distance_remaining_m = null,
         occupancy = greatest(occupancy - v_count, 0)
   where id = p_bus
  returning * into v_bus;

  select t.stop_id into v_terminal
    from terminals t join destinations d on d.route = t.route
   where d.code = v_bus.destination;

  insert into bus_events (bus_id, stop_id, event, source, boarded_count, occupancy)
  values (p_bus, v_terminal, 'completed', p_source, v_count, v_bus.occupancy);

  return jsonb_build_object(
    'status', 'completed', 'bus_id', p_bus, 'completed_count', v_count, 'occupancy', v_bus.occupancy
  );
end;
$$;

-- HQ's "Reset bus" now ends the trip the same way (riders get off at the terminal).
create or replace function public.reset_bus(p_bus text)
returns jsonb
language sql
security definer
set search_path = public
as $$ select public.complete_trip(p_bus, 'dashboard') $$;

-- 4. Driver's correction -----------------------------------------------------------
create or replace function public.adjust_occupancy(p_bus text, p_delta int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bus  buses%rowtype;
  v_new  int;
begin
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10 then
    return jsonb_build_object('status', 'error', 'message', 'Change must be between -10 and 10');
  end if;

  select * into v_bus from buses where id = p_bus for update;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'Bus not found');
  end if;

  v_new := least(greatest(v_bus.occupancy + p_delta, 0), v_bus.seats + v_bus.standing);
  if v_new = v_bus.occupancy then
    return jsonb_build_object('status', 'unchanged', 'bus_id', p_bus, 'occupancy', v_new);
  end if;

  update buses set occupancy = v_new where id = p_bus;

  insert into bus_events (bus_id, event, source, delta, occupancy)
  values (p_bus, 'occupancy', 'manual', v_new - v_bus.occupancy, v_new);

  return jsonb_build_object('status', 'adjusted', 'bus_id', p_bus, 'occupancy', v_new);
end;
$$;

-- 5. GPS: a bus that boarded and drives back into its terminal completes the trip ----
-- Same as 20261029140000 plus the return-leg check for 'arrived' buses.
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

  select route into v_route from destinations where code = v_bus.destination;
  select * into v_terminal from terminals where route = v_route;

  if v_bus.status = 'arrived' and v_terminal.id is not null
     and haversine_m(p_lat, p_lng, v_terminal.lat, v_terminal.lng) <= v_terminal.radius_m then
    return complete_trip(p_bus, 'gps');
  end if;

  if v_bus.status <> 'on_the_way' then
    return jsonb_build_object('status', 'stored', 'bus_status', v_bus.status);
  end if;

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

-- 6. Dispatch on free places -------------------------------------------------------
create or replace function public.run_dispatch()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d           destinations%rowtype;
  v_pending   dispatch_decisions%rowtype;
  v_release   numeric := config_value('release_load_pct', 70);
  v_max_wait  numeric := config_value('max_wait_minutes', 15);
  v_waiting   int;
  v_oldest    numeric;
  v_otw       int;
  v_otw_free  int;
  v_next_free int;
  v_uncovered int;
  v_load      numeric;
  v_action    text;
  v_reason    text;
begin
  for d in select * from destinations order by sort_order, code loop
    select count(*),
           round((extract(epoch from now() - min(created_at)) / 60)::numeric, 1)
      into v_waiting, v_oldest
      from queue_tokens
     where destination = d.code and status = 'waiting';

    select count(*), coalesce(sum(bus_free_places(b)), 0)::int
      into v_otw, v_otw_free
      from buses b
     where b.destination = d.code and b.status = 'on_the_way';

    -- The bus HQ would release next: the emptiest one at the terminal.
    select max(bus_free_places(b)) into v_next_free
      from buses b
     where b.destination = d.code and b.status = 'at_terminal';
    v_next_free := greatest(coalesce(v_next_free, d.bus_capacity), 1);

    v_uncovered := greatest(v_waiting - v_otw_free, 0);
    v_load := round(v_uncovered::numeric / v_next_free * 100, 1);

    if v_otw > 0 then
      -- A bus is on the way: only ask for another when it can't take everyone.
      if v_uncovered > 0 and v_load >= v_release then
        v_action := 'release';
        v_reason := format('%s more waiting than the %s free places on the bus on the way · %s%% ≥ %s%%',
                           v_uncovered, v_otw_free, round(v_load), v_release);
      else
        continue;
      end if;
    elsif v_waiting > 0 and v_load >= v_release then
      v_action := 'release';
      v_reason := format('Load %s%% of %s free places ≥ %s%%', round(v_load), v_next_free, v_release);
    elsif v_waiting > 0 and v_oldest >= v_max_wait then
      v_action := 'release';
      v_reason := format('Oldest wait %s min ≥ %s min', floor(v_oldest), v_max_wait);
    elsif v_waiting = 0 then
      v_action := 'hold';
      v_reason := 'No one waiting';
    else
      v_action := 'hold';
      v_reason := format('Low demand (%s waiting, %s free places)', v_waiting, v_next_free);
    end if;

    select * into v_pending
      from dispatch_decisions
     where destination = d.code and status = 'pending'
     order by created_at desc, id desc
     limit 1;

    if found and v_pending.action = v_action then
      -- Same recommendation: keep the row, refresh its numbers.
      update dispatch_decisions
         set reason = v_reason, waiting = v_waiting,
             load_pct = v_load, oldest_wait_min = v_oldest
       where id = v_pending.id
         and (reason, waiting, load_pct, oldest_wait_min)
             is distinct from (v_reason, v_waiting, v_load, v_oldest);
      continue;
    end if;

    update dispatch_decisions
       set status = 'superseded', decided_at = now()
     where destination = d.code and status = 'pending';

    insert into dispatch_decisions
      (destination, action, reason, waiting, load_pct, oldest_wait_min)
    values
      (d.code, v_action, v_reason, v_waiting, v_load, v_oldest);
  end loop;
end;
$$;

-- Release the emptiest bus at the terminal (was: the first by id).
create or replace function public.approve_decision(p_decision bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dec dispatch_decisions%rowtype;
  v_bus text;
  v_eta int := config_value('default_eta_minutes', 8)::int;
begin
  select * into v_dec from dispatch_decisions where id = p_decision for update;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'Decision not found');
  end if;
  if v_dec.status <> 'pending' then
    return jsonb_build_object('status', 'error',
      'message', format('Decision is already %s', v_dec.status));
  end if;
  if v_dec.action <> 'release' then
    return jsonb_build_object('status', 'error',
      'message', 'Only release recommendations can be approved');
  end if;

  select b.id into v_bus
    from buses b
   where b.destination = v_dec.destination and b.status = 'at_terminal'
   order by bus_free_places(b) desc, b.id
   limit 1
   for update skip locked;

  if v_bus is null then
    return jsonb_build_object('status', 'no_bus',
      'message', 'No bus is free at the terminal for this route');
  end if;

  update dispatch_decisions
     set status = 'approved', decided_at = now()
   where id = p_decision;

  update buses
     set status = 'on_the_way', released_at = now(), eta_minutes = v_eta
   where id = v_bus;

  insert into bus_events (bus_id, stop_id, event, source)
  values (v_bus, kiosk_stop_id(), 'released', 'dashboard');

  return jsonb_build_object('status', 'approved', 'bus_id', v_bus, 'eta_minutes', v_eta);
end;
$$;

-- 7. Demo reset also empties the buses -----------------------------------------------
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
         lat = null, lng = null, location_updated_at = null, occupancy = 0,
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

-- 8. Grants --------------------------------------------------------------------------
revoke execute on function
  public.complete_trip(text, text),
  public.adjust_occupancy(text, int),
  public.bus_free_places(public.buses)
from public;

grant execute on function
  public.complete_trip(text, text),
  public.adjust_occupancy(text, int),
  public.bus_free_places(public.buses)
to anon, authenticated;
