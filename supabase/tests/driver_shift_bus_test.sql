-- Drivers pick their shift bus: only drivers, one driver per bus, GPS only for the chosen bus.
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

create temp table u (name text primary key, id uuid);
insert into u values ('d1', gen_random_uuid()), ('d2', gen_random_uuid()), ('viewer', gen_random_uuid());
insert into auth.users (id, email, aud, role)
select id, 'shift-test-' || name || '@example.test', 'authenticated', 'authenticated' from u;
update profiles p set role = case when u.name = 'viewer' then 'viewer' else 'driver' end, bus_id = null
  from u where p.id = u.id;
-- Free every bus from other drivers, inside this transaction only.
update profiles set bus_id = null where role = 'driver' and id not in (select id from u);
update buses set status = 'on_the_way', released_at = now() where id in ('R2-01', 'R3-01');

do $$
declare
  d1 uuid := (select id from u where name = 'd1');
  d2 uuid := (select id from u where name = 'd2');
  vw uuid := (select id from u where name = 'viewer');
begin
  perform pg_temp.ok(pg_temp.act(d1, $q$select choose_my_bus('R3-01')->>'status'$q$) = 'ok', '1 a driver picks R3-01');
  perform pg_temp.ok((select bus_id from profiles where id = d1) = 'R3-01', '2 their profile now holds R3-01');
  perform pg_temp.ok(pg_temp.act(d1, $q$select update_bus_location('R3-01', -1.95, 30.1, 5, 8)->>'status'$q$) <> 'ERR 42501',
                     '3 and their GPS is accepted for R3-01');
  perform pg_temp.ok(pg_temp.act(d1, $q$select update_bus_location('R2-01', -1.95, 30.1, 5, 8)$q$) = 'ERR 42501',
                     '4 but not for any other bus');
  perform pg_temp.ok(pg_temp.act(d2, $q$select choose_my_bus('R3-01')->>'status'$q$) = 'taken',
                     '5 a second driver cannot take R3-01');
  perform pg_temp.ok(pg_temp.act(d2, $q$select 'R3-01' = any(taken_buses())$q$) = 'true',
                     '6 and sees it as taken');
  perform pg_temp.ok(pg_temp.act(d1, $q$select not ('R3-01' = any(taken_buses()))$q$) = 'true',
                     '7 their own bus is not shown as taken to them');
  perform pg_temp.ok(pg_temp.act(d1, $q$select choose_my_bus('R2-01')->>'status'$q$) = 'ok', '8 changing bus works');
  perform pg_temp.ok(pg_temp.act(d1, $q$select update_bus_location('R3-01', -1.95, 30.1, 5, 8)$q$) = 'ERR 42501',
                     '9 and the old bus no longer takes their GPS');
  perform pg_temp.ok(pg_temp.act(d2, $q$select choose_my_bus('R3-01')->>'status'$q$) = 'ok', '10 the freed bus can be taken');
  perform pg_temp.ok(pg_temp.act(d1, $q$select choose_my_bus('XX-99')->>'status'$q$) = 'error', '11 an unknown bus is refused');
  perform pg_temp.ok(pg_temp.act(vw, $q$select choose_my_bus('R4-01')$q$) = 'ERR 42501', '12 a viewer cannot pick a bus');
  perform pg_temp.ok(not has_function_privilege('anon', 'public.choose_my_bus(text)', 'execute'),
                     '13 signed out cannot call it');
end $$;

select n, check_name as passed from results order by n;

rollback;
