-- Role-based access (Phase 7): each role can and can't do the right things.
-- Acts as each user the way the API does (role authenticated/anon + JWT claims).
-- Runs in one transaction and ALWAYS rolls back.

begin;

create temp table results (n serial, check_name text);

create function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAILED: %', p_name;
  end if;
  insert into results (check_name) values (p_name);
end $$;

-- Run one statement as a user (null = signed out). Returns its first value, 'ok' for no value,
-- or 'ERR <sqlstate>' when it raised.
create function pg_temp.act(p_user uuid, p_sql text) returns text language plpgsql as $$
declare
  v text;
begin
  if p_user is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
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

-- One test user per role (the sign-up trigger makes their profiles).
create temp table u (role text primary key, id uuid);
insert into u values
  ('admin',      gen_random_uuid()), ('dispatcher', gen_random_uuid()), ('driver', gen_random_uuid()),
  ('kiosk',      gen_random_uuid()), ('viewer',     gen_random_uuid()), ('signup',  gen_random_uuid());
insert into auth.users (id, email, aud, role)
select id, 'roles-test-' || role || '@example.test', 'authenticated', 'authenticated' from u;
update profiles p set role = u.role, bus_id = case when u.role = 'driver' then 'R2-01' end
  from u where p.id = u.id and u.role <> 'signup';
create function pg_temp.uid(p_role text) returns uuid language sql as $$ select id from u where role = p_role $$;

update queue_tokens set status = 'expired' where status = 'waiting';
update buses set status = 'at_terminal', occupancy = 0;
delete from dispatch_decisions where status = 'pending';

do $$
declare
  r text;
  v_decision bigint;
begin
  -- Sign-up and profiles
  perform pg_temp.ok((select role from profiles where id = pg_temp.uid('signup')) = 'viewer',
                     '1 a new sign-up starts as viewer');
  perform pg_temp.ok(demo_role_for('Driver@TapSelect.demo') = 'driver', '2 demo emails map to their roles');

  -- Signed out
  perform pg_temp.ok(pg_temp.act(null, 'select count(*) from buses') = '0', '3 signed out: reads nothing');
  perform pg_temp.ok(pg_temp.act(null, $q$select create_token('STOP-01','REM','ROLE-1','manual')$q$) like 'ERR 42501',
                     '4 signed out: cannot create a ticket');

  -- Viewer
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('viewer'), 'select count(*) from buses') = '8', '5 viewer reads buses');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('viewer'), $q$select create_token('STOP-01','REM','ROLE-1','manual')$q$) = 'ERR 42501',
                     '6 viewer cannot create a ticket');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('viewer'), 'select run_dispatch()') = 'ERR 42501', '7 viewer cannot recompute');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('viewer'),
                     $q$with x as (update config set value = 99 where key = 'release_load_pct' returning 1) select count(*) from x$q$) = '0',
                     '8 viewer cannot change config');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('viewer'), 'select count(*) from profiles') = '1', '9 viewer sees only their own profile');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('viewer'),
                     $q$with x as (update profiles set role = 'admin' where id = auth.uid() returning 1) select count(*) from x$q$) = '0',
                     '10 viewer cannot promote themselves');

  -- Kiosk
  r := pg_temp.act(pg_temp.uid('kiosk'), $q$select create_token('STOP-01','REM','ROLE-1','voice',0.9)->>'status'$q$);
  perform pg_temp.ok(r = 'created', '11 kiosk creates a ticket');
  r := pg_temp.act(pg_temp.uid('kiosk'), $q$select log_selection('STOP-01','REM','voice',0.9,'confirmed',null)::text$q$);
  perform pg_temp.ok(r not like 'ERR%', '12 kiosk logs a selection');
  r := pg_temp.act(pg_temp.uid('kiosk'), $q$select cancel_token('ROLE-1','other')->>'status'$q$);
  perform pg_temp.ok(r = 'cancelled', '13 kiosk cancels a place');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('kiosk'), $q$select update_bus_location('R2-01',-1.95,30.07,5,10)$q$) = 'ERR 42501',
                     '14 kiosk cannot move a bus');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('kiosk'), $q$select reset_demo()$q$) = 'ERR 42501', '15 kiosk cannot reset the demo');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('kiosk'),
                     $q$insert into queue_tokens (code, stop_id, destination, method) values ('X','STOP-01','REM','manual')$q$) = 'ERR 42501',
                     '16 kiosk cannot write tickets directly');

  -- Driver (R2-01)
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('driver'), $q$select update_bus_location('R2-01',-1.95,30.07,5,10)->>'status'$q$) = 'stored',
                     '17 driver updates their own bus');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('driver'), $q$select update_bus_location('R3-01',-1.95,30.07,5,10)$q$) = 'ERR 42501',
                     '18 driver cannot update another bus');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('driver'), $q$select adjust_occupancy('R2-01',1)::text$q$) not like 'ERR%',
                     '19 driver corrects their own occupancy');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('driver'), $q$select adjust_occupancy('R3-01',1)$q$) = 'ERR 42501',
                     '20 driver cannot change another bus');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('driver'), $q$select mark_bus_arrived('R3-01','manual')$q$) = 'ERR 42501',
                     '21 driver cannot arrive another bus');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('driver'), $q$select create_token('STOP-01','REM','ROLE-2','manual')$q$) = 'ERR 42501',
                     '22 driver cannot create a ticket');

  -- Dispatcher
  update config set value = 1 where key = 'release_load_pct';
  perform private.create_token('STOP-01', 'KIM', 'ROLE-3', 'manual', null);
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('dispatcher'), 'select run_dispatch()') = 'ok', '23 dispatcher recomputes');
  select id into v_decision from dispatch_decisions where destination = 'KIM' and status = 'pending' and action = 'release';
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('kiosk'), format('select approve_decision(%s)', v_decision)) = 'ERR 42501',
                     '24 kiosk cannot approve');
  r := pg_temp.act(pg_temp.uid('dispatcher'), format('select approve_decision(%s)->>''bus_id''', v_decision));
  perform pg_temp.ok(r like 'R3-0_', '25 dispatcher approves a release');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('dispatcher'), format($q$select mark_bus_arrived('%s','dashboard')->>'status'$q$, r)) = 'arrived',
                     '26 dispatcher marks any bus arrived');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('dispatcher'), format($q$select reset_bus('%s')::text$q$, r)) not like 'ERR%',
                     '27 dispatcher resets a bus');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('dispatcher'),
                     $q$with x as (update config set value = 99 where key = 'release_load_pct' returning 1) select count(*) from x$q$) = '0',
                     '28 dispatcher cannot change config');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('dispatcher'), 'select reset_demo()') = 'ERR 42501', '29 dispatcher cannot reset the demo');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('dispatcher'),
                     format($q$select set_user_role('%s','admin')$q$, pg_temp.uid('viewer'))) = 'ERR 42501',
                     '30 dispatcher cannot change roles');

  -- Admin
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('admin'),
                     $q$with x as (update config set value = 60 where key = 'release_load_pct' returning 1) select count(*) from x$q$) = '1',
                     '31 admin changes config');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('admin'), 'select count(*) from profiles') = (select count(*)::text from profiles),
                     '32 admin sees every profile');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('admin'),
                     format($q$select set_user_role('%s','driver','R4-02')->>'status'$q$, pg_temp.uid('signup'))) = 'ok',
                     '33 admin makes a sign-up the driver of R4-02');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('signup'), $q$select update_bus_location('R4-02',-1.95,30.07,5,10)->>'status'$q$) = 'stored',
                     '34 the new driver can now move R4-02');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('admin'),
                     format($q$select set_user_role('%s','driver',null)->>'status'$q$, pg_temp.uid('viewer'))) = 'error',
                     '35 a driver needs a bus');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('admin'),
                     format($q$select set_user_role('%s','viewer')->>'status'$q$, pg_temp.uid('admin'))) = 'error',
                     '36 admins cannot change their own role');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('admin'), $q$select create_token('STOP-01','NYA','ROLE-4','manual')->>'status'$q$) = 'created',
                     '37 admin can do everything (create a ticket)');

  -- Simulator path (kiosk role) and trusted callers
  perform private.create_token('STOP-02', 'REM', 'ROLE-SIM', 'rfid', null);
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('kiosk'), $q$select expire_waiting_tokens(array['STOP-02','STOP-01'])$q$) = '1',
                     '38 the simulator expires its stops only, never the kiosk queue');
  perform pg_temp.ok(pg_temp.act(pg_temp.uid('kiosk'), $q$select count(*) from private.create_token('a','b','c','d',null)$q$) = 'ERR 42501',
                     '39 the private originals are out of reach');
  perform run_dispatch();
  perform pg_temp.ok(true, '40 trusted callers (pg_cron, SQL) still run run_dispatch');
end $$;

select n, check_name as passed from results order by n;

rollback;
