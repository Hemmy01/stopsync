-- StopSync business rules. Every screen calls these, so queue numbers,
-- dispatch and boarding behave the same everywhere. See CLAUDE.md section 8.

-- The single demo kiosk. ETA and arrival are measured against this stop.
create or replace function public.kiosk_stop_id()
returns text
language sql
immutable
set search_path = public
as $$ select 'STOP-01'::text $$;

create or replace function public.config_value(p_key text, p_default numeric)
returns numeric
language sql
stable
set search_path = public
as $$ select coalesce((select value from config where key = p_key), p_default) $$;

-- Great-circle distance in metres.
create or replace function public.haversine_m(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
)
returns double precision
language sql
immutable
set search_path = public
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2))
      * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  ))
$$;

-- 1. create_token ------------------------------------------------------------
create or replace function public.create_token(
  p_stop text, p_dest text, p_card text, p_method text, p_conf numeric
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
   where destination = p_dest and status = 'waiting' and id <= v_id;

  return jsonb_build_object(
    'status', 'created',
    'code', v_code,
    'destination', p_dest,
    'position', v_position
  );
end;
$$;

-- 2. run_dispatch ------------------------------------------------------------
create or replace function public.run_dispatch()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d          destinations%rowtype;
  v_pending  dispatch_decisions%rowtype;
  v_release  numeric := config_value('release_load_pct', 70);
  v_max_wait numeric := config_value('max_wait_minutes', 15);
  v_waiting  int;
  v_oldest   numeric;
  v_load     numeric;
  v_action   text;
  v_reason   text;
begin
  for d in select * from destinations order by sort_order, code loop
    if exists (
      select 1 from buses where destination = d.code and status = 'on_the_way'
    ) then
      continue;
    end if;

    select count(*),
           round((extract(epoch from now() - min(created_at)) / 60)::numeric, 1)
      into v_waiting, v_oldest
      from queue_tokens
     where destination = d.code and status = 'waiting';

    v_load := round(v_waiting::numeric / d.bus_capacity * 100, 1);

    if v_waiting > 0 and v_load >= v_release then
      v_action := 'release';
      v_reason := format('Load %s%% ≥ %s%%', round(v_load), v_release);
    elsif v_waiting > 0 and v_oldest >= v_max_wait then
      v_action := 'release';
      v_reason := format('Oldest wait %s min ≥ %s min', floor(v_oldest), v_max_wait);
    elsif v_waiting = 0 then
      v_action := 'hold';
      v_reason := 'No one waiting';
    else
      v_action := 'hold';
      v_reason := format('Low demand (%s waiting)', v_waiting);
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

-- 3. approve_decision --------------------------------------------------------
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

  select id into v_bus
    from buses
   where destination = v_dec.destination and status = 'at_terminal'
   order by id
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

-- 4. dismiss_decision --------------------------------------------------------
create or replace function public.dismiss_decision(p_decision bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update dispatch_decisions
     set status = 'dismissed', decided_at = now()
   where id = p_decision and status = 'pending';
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'Decision is not pending');
  end if;
  return jsonb_build_object('status', 'dismissed');
end;
$$;

-- 6. mark_bus_arrived (defined before update_bus_location, which calls it) ----
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

  update buses set status = 'arrived', eta_minutes = null where id = p_bus;

  insert into bus_events (bus_id, stop_id, event, source, boarded_count)
  values (p_bus, kiosk_stop_id(), 'arrived', p_source, v_count);

  return jsonb_build_object('status', 'arrived', 'bus_id', p_bus, 'boarded_count', v_count);
end;
$$;

-- 5. update_bus_location -----------------------------------------------------
create or replace function public.update_bus_location(
  p_bus text, p_lat double precision, p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bus      buses%rowtype;
  v_stop     stops%rowtype;
  v_dist_m   double precision;
  v_speed    numeric := greatest(config_value('avg_bus_speed_kmh', 18), 1);
  v_radius   numeric := config_value('arrival_radius_m', 50);
  v_eta      int;
  v_arrival  jsonb;
begin
  update buses
     set lat = p_lat, lng = p_lng, location_updated_at = now()
   where id = p_bus
  returning * into v_bus;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'Bus not found');
  end if;

  if v_bus.status <> 'on_the_way' then
    return jsonb_build_object('status', 'stored', 'bus_status', v_bus.status);
  end if;

  select * into v_stop from stops where id = kiosk_stop_id();
  v_dist_m := haversine_m(p_lat, p_lng, v_stop.lat, v_stop.lng);

  if v_dist_m <= v_radius then
    v_arrival := mark_bus_arrived(p_bus, 'gps');
    return v_arrival || jsonb_build_object('distance_m', round(v_dist_m::numeric));
  end if;

  v_eta := greatest(ceil(v_dist_m / 1000 / v_speed * 60)::int, 1);
  update buses set eta_minutes = v_eta where id = p_bus;

  return jsonb_build_object(
    'status', 'on_the_way',
    'distance_m', round(v_dist_m::numeric),
    'eta_minutes', v_eta
  );
end;
$$;

-- 7. reset_bus ---------------------------------------------------------------
create or replace function public.reset_bus(p_bus text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update buses
     set status = 'at_terminal', eta_minutes = null, released_at = null
   where id = p_bus;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'Bus not found');
  end if;

  insert into bus_events (bus_id, stop_id, event, source)
  values (p_bus, kiosk_stop_id(), 'reset', 'dashboard');

  return jsonb_build_object('status', 'reset', 'bus_id', p_bus);
end;
$$;

-- Grants ---------------------------------------------------------------------
revoke execute on function
  public.create_token(text, text, text, text, numeric),
  public.run_dispatch(),
  public.approve_decision(bigint),
  public.dismiss_decision(bigint),
  public.update_bus_location(text, double precision, double precision),
  public.mark_bus_arrived(text, text),
  public.reset_bus(text)
from public;

grant execute on function
  public.create_token(text, text, text, text, numeric),
  public.run_dispatch(),
  public.approve_decision(bigint),
  public.dismiss_decision(bigint),
  public.update_bus_location(text, double precision, double precision),
  public.mark_bus_arrived(text, text),
  public.reset_bus(text)
to anon, authenticated;
