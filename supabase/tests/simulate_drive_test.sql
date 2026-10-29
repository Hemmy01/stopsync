-- Simulate drive: only dispatchers, only a bus on the way, same effects as real GPS.
-- Always rolls back.

begin;

create temp table results (n serial, check_name text);

create function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAILED: %', p_name;
  end if;
  insert into results (check_name) values (p_name);
end $$;

create function pg_temp.act(p_user uuid, p_sql text) returns text language plpgsql as $$
declare
  v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    execute p_sql into v;
    v := coalesce(nullif(v, ''), 'ok');
  exception when others then
    v := 'ERR ' || sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;

create temp table u (role text primary key, id uuid);
insert into u values ('dispatcher', gen_random_uuid()), ('driver', gen_random_uuid()), ('viewer', gen_random_uuid());
insert into auth.users (id, email, aud, role)
select id, 'sim-test-' || role || '@example.test', 'authenticated', 'authenticated' from u;
update profiles p set role = u.role, bus_id = case when u.role = 'driver' then 'R2-01' end from u where p.id = u.id;

update queue_tokens set status = 'expired' where status = 'waiting';
update buses set status = 'at_terminal', occupancy = 0, released_at = null, departed_at = null,
                 eta_minutes = null, last_stop_id = null, next_stop_id = null,
                 stops_remaining = null, distance_remaining_m = null;

do $$
declare
  d uuid := (select id from u where role = 'dispatcher');
  v_kiosk stops%rowtype;
  v_stop  record;
  v_code  text;
begin
  select * into v_kiosk from stops where id = 'STOP-01';
  perform pg_temp.ok(pg_temp.act(d, $q$select simulate_bus_position('R2-01', -1.95, 30.07)->>'status'$q$) = 'error',
                     '1 a bus at the terminal cannot be simulated');

  update buses set status = 'on_the_way', released_at = now() where id = 'R2-01';
  perform pg_temp.ok(pg_temp.act((select id from u where role = 'viewer'), $q$select simulate_bus_position('R2-01', -1.95, 30.07)$q$) = 'ERR 42501',
                     '2 a viewer cannot simulate');
  perform pg_temp.ok(pg_temp.act((select id from u where role = 'driver'), $q$select simulate_bus_position('R2-01', -1.95, 30.07)$q$) = 'ERR 42501',
                     '3 nor a driver (they share real GPS instead)');

  -- A passenger waiting at the kiosk, then drive R2's stops in order, ending at the kiosk.
  v_code := private.create_token('STOP-01', 'REM', 'SIM-1', 'voice', 0.9)->>'code';
  for v_stop in
    select s.lat, s.lng from routes_stops rs join stops s on s.id = rs.stop_id
     where rs.route = 'R2' order by rs.seq
  loop
    perform pg_temp.act(d, format('select simulate_bus_position(%L, %s, %s)', 'R2-01', v_stop.lat, v_stop.lng));
  end loop;

  perform pg_temp.ok((select departed_at is not null from buses where id = 'R2-01'), '4 the bus left its terminal');
  perform pg_temp.ok((select status from buses where id = 'R2-01') = 'arrived', '5 and arrived at the kiosk by GPS');
  perform pg_temp.ok((select status from queue_tokens where code = v_code and card_id = 'SIM-1') = 'boarded',
                     '6 the waiting passenger boarded');
  perform pg_temp.ok(pg_temp.act(d, format('select simulate_bus_position(%L, %s, %s)->>''status''', 'R2-01', v_kiosk.lat, v_kiosk.lng)) = 'error',
                     '7 an arrived bus is no longer simulated');
end $$;

select n, check_name as passed from results order by n;

rollback;
