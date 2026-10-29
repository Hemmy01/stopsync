-- Automatic FIFO queue (Phase 5 of the judges' feedback round). Agreed 2026-10-29:
--   * a bus arriving at a stop boards the oldest waiting tickets for its route AT THAT STOP,
--     up to its free places (seats + standing), one boarding at a time per route and stop
--   * along the route too: GPS within a stop's arrival radius boards that stop's queue,
--     so the simulator's tickets (STOP-02…06) are served by the routes that pass them
--   * early or unscheduled buses (not released by HQ) serve the queue the same way
--   * dispatch counts only tickets at stops the route serves
--   * optional auto_dispatch (off by default) releases a bus by itself when load ≥ threshold,
--     at most max_auto_releases_per_hour per route

-- 1. Events, sources and settings ---------------------------------------------------
alter table public.bus_events drop constraint bus_events_event_check;
alter table public.bus_events add constraint bus_events_event_check
  check (event in ('released', 'departed', 'boarded', 'arrived', 'completed', 'occupancy', 'reset'));

alter table public.bus_events drop constraint bus_events_source_check;
alter table public.bus_events add constraint bus_events_source_check
  check (source in ('dashboard', 'gps', 'manual', 'auto'));

insert into public.config (key, value, description) values
  ('auto_dispatch', 0, 'Release buses automatically when load ≥ release_load_pct (1 = on, 0 = off)'),
  ('max_auto_releases_per_hour', 4, 'Per route: the most buses auto_dispatch may release in an hour')
on conflict (key) do nothing;

-- 2. The FIFO allocation -------------------------------------------------------------
-- Boards the oldest waiting tickets for the bus's route at one stop, up to its free places.
-- The advisory lock serialises boardings per route and stop, so two buses arriving together
-- never take the same tickets and nobody is skipped; the remaining tickets keep their order.
create or replace function public.board_queue(p_bus text, p_stop text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bus   buses%rowtype;
  v_free  int;
  v_count int;
  v_first text;
  v_last  text;
begin
  select * into v_bus from buses where id = p_bus;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'Bus not found');
  end if;

  perform pg_advisory_xact_lock(hashtext('board_queue:' || v_bus.destination || ':' || p_stop));

  select * into v_bus from buses where id = p_bus for update;
  v_free := bus_free_places(v_bus);

  with called as (
    select id, code, created_at from queue_tokens
     where destination = v_bus.destination and stop_id = p_stop and status = 'waiting'
     order by created_at, id
     limit v_free
     for update
  ), boarded as (
    update queue_tokens q
       set status = 'boarded', boarded_at = now(), bus_id = p_bus
      from called c
     where q.id = c.id
    returning c.code, c.created_at, c.id
  )
  select count(*),
         (array_agg(code order by created_at, id))[1],
         (array_agg(code order by created_at desc, id desc))[1]
    into v_count, v_first, v_last
    from boarded;

  if v_count > 0 then
    update buses set occupancy = occupancy + v_count where id = p_bus;
  end if;

  return jsonb_build_object(
    'boarded_count', v_count, 'first_code', v_first, 'last_code', v_last,
    'occupancy', v_bus.occupancy + v_count, 'free_places', v_free - v_count
  );
end;
$$;

-- 3. Arrival at the kiosk: whatever the bus's status (released, early or unscheduled) ---
create or replace function public.mark_bus_arrived(p_bus text, p_source text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bus   buses%rowtype;
  v_board jsonb;
begin
  if p_source not in ('dashboard', 'gps', 'manual') then
    return jsonb_build_object('status', 'error', 'message', 'Unknown source');
  end if;

  select * into v_bus from buses where id = p_bus;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'Bus not found');
  end if;
  if v_bus.status = 'arrived' then
    return jsonb_build_object('status', 'already_arrived', 'bus_id', p_bus, 'boarded_count', 0);
  end if;

  v_board := board_queue(p_bus, kiosk_stop_id());

  update buses
     set status = 'arrived', eta_minutes = null, next_stop_id = null, last_stop_id = kiosk_stop_id(),
         stops_remaining = 0, distance_remaining_m = 0
   where id = p_bus
  returning * into v_bus;

  insert into bus_events (bus_id, stop_id, event, source, boarded_count, occupancy)
  values (p_bus, kiosk_stop_id(), 'arrived', p_source, (v_board->>'boarded_count')::int, v_bus.occupancy);

  return v_board || jsonb_build_object(
    'status', 'arrived', 'bus_id', p_bus, 'unscheduled', v_bus.released_at is null
  );
end;
$$;

-- 4. GPS: board along the route, arrive (also unscheduled), complete back at terminal --
-- Same as 20261029180000 plus stop boarding and unscheduled arrival.
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
  v_at_stop   text;
  v_board     jsonb;
  v_boarded   int := 0;
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

  if v_bus.status = 'arrived' then
    return jsonb_build_object('status', 'stored', 'bus_status', v_bus.status);
  end if;

  select * into v_kiosk from stops where id = kiosk_stop_id();
  v_kiosk_m := haversine_m(p_lat, p_lng, v_kiosk.lat, v_kiosk.lng);

  -- At the kiosk: released, early or unscheduled, it arrives and boards the queue.
  if v_kiosk_m <= v_radius then
    return mark_bus_arrived(p_bus, 'gps') || jsonb_build_object('distance_m', round(v_kiosk_m::numeric));
  end if;

  -- At a stop along the route: board that stop's queue. A bus waiting at its terminal
  -- without a release doesn't board there (it's parked, not serving).
  select rs.stop_id into v_at_stop
    from routes_stops rs
    join stops s on s.id = rs.stop_id
   where rs.route = v_route and rs.stop_id <> kiosk_stop_id()
     and (rs.seq > 0 or v_bus.status = 'on_the_way')
     and haversine_m(p_lat, p_lng, s.lat, s.lng)
         <= case when rs.seq = 0 then coalesce(v_terminal.radius_m, v_radius) else v_radius end
   order by haversine_m(p_lat, p_lng, s.lat, s.lng)
   limit 1;

  if v_at_stop is not null then
    v_board := board_queue(p_bus, v_at_stop);
    v_boarded := (v_board->>'boarded_count')::int;
    if v_boarded > 0 then
      insert into bus_events (bus_id, stop_id, event, source, boarded_count, occupancy)
      values (p_bus, v_at_stop, 'boarded', 'gps', v_boarded, (v_board->>'occupancy')::int);
    end if;
  end if;

  if v_bus.status <> 'on_the_way' then
    return jsonb_build_object('status', 'stored', 'bus_status', v_bus.status,
                              'at_stop', v_at_stop, 'boarded_count', v_boarded);
  end if;

  -- Released bus leaving its terminal for the first time.
  if v_bus.departed_at is null and v_terminal.id is not null
     and haversine_m(p_lat, p_lng, v_terminal.lat, v_terminal.lng) > v_terminal.radius_m then
    update buses set departed_at = now() where id = p_bus;
    insert into bus_events (bus_id, stop_id, event, source)
    values (p_bus, v_terminal.stop_id, 'departed', 'gps');
    v_departed := true;
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
    'departed', v_departed,
    'at_stop', v_at_stop,
    'boarded_count', v_boarded
  );
end;
$$;

-- 5. Queue position per stop -----------------------------------------------------------
-- Same as 20261027180000 except the position counts only this stop's queue (FIFO is per stop).
create or replace function public.create_token(
  p_stop text, p_dest text, p_card text, p_method text, p_conf numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing  queue_tokens%rowtype;
  v_route     text;
  v_day_start timestamptz;
  v_seq       int;
  v_code      text;
  v_id        bigint;
  v_position  int;
begin
  if p_card is not null then
    select * into v_existing
      from queue_tokens
     where card_id = p_card and status = 'waiting'
     limit 1;
    if found then
      return jsonb_build_object(
        'status', 'duplicate',
        'code', v_existing.code,
        'destination', v_existing.destination
      );
    end if;
  end if;

  select route into v_route from destinations where code = p_dest;
  if v_route is null then
    return jsonb_build_object('status', 'error', 'message', 'Unknown destination');
  end if;

  -- Serialise numbering per destination so two taps never get the same code.
  perform pg_advisory_xact_lock(hashtext('create_token:' || p_dest));

  v_day_start := date_trunc('day', now() at time zone 'Africa/Kigali')
                   at time zone 'Africa/Kigali';

  select count(*) + 1 into v_seq
    from queue_tokens
   where destination = p_dest and created_at >= v_day_start;

  v_code := v_route || '-' || lpad(v_seq::text, 3, '0');

  begin
    insert into queue_tokens (code, stop_id, destination, card_id, method, confidence)
    values (v_code, p_stop, p_dest, p_card, p_method, p_conf)
    returning id into v_id;
  exception when unique_violation then
    -- The same card was tapped twice at the same instant.
    select * into v_existing
      from queue_tokens
     where card_id = p_card and status = 'waiting'
     limit 1;
    return jsonb_build_object(
      'status', 'duplicate',
      'code', v_existing.code,
      'destination', v_existing.destination
    );
  end;

  select count(*) into v_position
    from queue_tokens
   where destination = p_dest and stop_id = p_stop and status = 'waiting' and id <= v_id;

  return jsonb_build_object(
    'status', 'created',
    'code', v_code,
    'destination', p_dest,
    'position', v_position
  );
end;
$$;

-- 6. Releasing a bus (HQ or auto) -------------------------------------------------------
create or replace function public.release_for_decision(p_decision bigint, p_source text)
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
  values (v_bus, kiosk_stop_id(), 'released', p_source);

  return jsonb_build_object('status', 'approved', 'bus_id', v_bus, 'eta_minutes', v_eta);
end;
$$;

create or replace function public.approve_decision(p_decision bigint)
returns jsonb
language sql
security definer
set search_path = public
as $$ select public.release_for_decision(p_decision, 'dashboard') $$;

-- 7. Dispatch: only tickets the route can serve; optional auto release -------------------
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
  v_auto      boolean := config_value('auto_dispatch', 0) >= 1;
  v_auto_max  int := config_value('max_auto_releases_per_hour', 4)::int;
  v_waiting   int;
  v_oldest    numeric;
  v_otw       int;
  v_otw_free  int;
  v_next_free int;
  v_uncovered int;
  v_load      numeric;
  v_action    text;
  v_reason    text;
  v_decision  bigint;
begin
  for d in select * from destinations order by sort_order, code loop
    select count(*),
           round((extract(epoch from now() - min(created_at)) / 60)::numeric, 1)
      into v_waiting, v_oldest
      from queue_tokens
     where destination = d.code and status = 'waiting'
       and stop_id in (select stop_id from routes_stops where route = d.route);

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
      v_decision := v_pending.id;
    else
      update dispatch_decisions
         set status = 'superseded', decided_at = now()
       where destination = d.code and status = 'pending';

      insert into dispatch_decisions
        (destination, action, reason, waiting, load_pct, oldest_wait_min)
      values
        (d.code, v_action, v_reason, v_waiting, v_load, v_oldest)
      returning id into v_decision;
    end if;

    -- Auto-dispatch: only on load (not on waiting time), within the hourly limit per route.
    if v_auto and v_action = 'release' and v_load >= v_release
       and (select count(*)
              from bus_events e join buses b on b.id = e.bus_id
             where e.event = 'released' and e.source = 'auto' and b.destination = d.code
               and e.created_at > now() - interval '1 hour') < v_auto_max then
      perform release_for_decision(v_decision, 'auto');
    end if;
  end loop;
end;
$$;

-- 8. Grants: the helpers are internal (called by the functions above) ------------------
revoke execute on function
  public.board_queue(text, text),
  public.release_for_decision(bigint, text)
from public, anon, authenticated;
