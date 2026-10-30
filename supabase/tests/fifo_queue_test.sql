-- FIFO boarding scenarios (Phase 5). Runs inside one transaction and ALWAYS rolls back,
-- so it is safe on the linked project:  supabase/tests/run.sh
-- Any failed check raises an exception naming it; on success the last query lists every check.
-- Not covered here: two sessions boarding at the same instant (board_queue's advisory lock).

begin;

create temp table results (n serial, check_name text);

create function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAILED: %', p_name;
  end if;
  insert into results (check_name) values (p_name);
end $$;

-- A clean slate for route R4 (Downtown, DTN), inside this transaction only.
update queue_tokens set status = 'expired' where status = 'waiting';
update buses set status = 'at_terminal', occupancy = 0, released_at = null, departed_at = null,
                 eta_minutes = null, last_stop_id = null, next_stop_id = null,
                 stops_remaining = null, distance_remaining_m = null;
delete from dispatch_decisions where status = 'pending';
update config set value = 0 where key = 'auto_dispatch';

-- Tickets T0…T5 at the kiosk: T0 created last (highest id) but stamped oldest. Seconds, not
-- minutes, so the tickets never fall into yesterday (codes restart at Kigali midnight).
create temp table t (name text primary key, code text);
do $$
declare i int;
begin
  for i in 1..5 loop
    insert into t values ('T' || i, create_token('STOP-01', 'DTN', 'FIFO-' || i, 'gesture', 1)->>'code');
    update queue_tokens set created_at = now() - make_interval(secs => 30 - i)
     where code = (select code from t where name = 'T' || i) and status = 'waiting';
  end loop;
  insert into t values ('T0', create_token('STOP-01', 'DTN', 'FIFO-0', 'voice', 0.9)->>'code');
  update queue_tokens set created_at = now() - interval '45 seconds'
   where code = (select code from t where name = 'T0') and status = 'waiting';
end $$;

create function pg_temp.st(p_name text) returns text language sql as $$
  select q.status from queue_tokens q join t on t.code = q.code
   where t.name = p_name order by q.id desc limit 1 $$;
create function pg_temp.bus_of(p_name text) returns text language sql as $$
  select q.bus_id from queue_tokens q join t on t.code = q.code
   where t.name = p_name order by q.id desc limit 1 $$;

-- 1. A bus with 3 free places takes the 3 oldest, by time not by id ----------------------
update buses set occupancy = 67 where id = 'R4-01';
update buses set status = 'on_the_way', released_at = now() where id = 'R4-01';
do $$
declare r jsonb := mark_bus_arrived('R4-01', 'dashboard');
begin
  perform pg_temp.ok((r->>'boarded_count')::int = 3, '1a full-ish bus boards exactly its 3 free places');
  perform pg_temp.ok(pg_temp.st('T0') = 'boarded' and pg_temp.st('T1') = 'boarded' and pg_temp.st('T2') = 'boarded',
                     '1b the oldest three (T0, T1, T2) boarded');
  perform pg_temp.ok(pg_temp.st('T3') = 'waiting' and pg_temp.st('T4') = 'waiting' and pg_temp.st('T5') = 'waiting',
                     '1c the rest keep waiting');
  perform pg_temp.ok(r->>'first_code' = (select code from t where name = 'T0')
                     and r->>'last_code' = (select code from t where name = 'T2'), '1d first/last codes are T0 and T2');
  perform pg_temp.ok((select occupancy from buses where id = 'R4-01') = 70, '1e occupancy 67 + 3 = 70');
  perform pg_temp.ok(pg_temp.bus_of('T1') = 'R4-01', '1f boarded tickets remember their bus');
  perform pg_temp.ok((r->>'unscheduled')::boolean = false, '1g a released bus is not unscheduled');
end $$;

-- 2. Remaining order is kept: positions of T3, T4, T5 are 1, 2, 3 -------------------------
do $$
declare v_positions text;
begin
  select string_agg(t.name, ',' order by q.created_at, q.id) into v_positions
    from queue_tokens q join t on t.code = q.code
   where q.status = 'waiting' and q.stop_id = 'STOP-01' and q.destination = 'DTN';
  perform pg_temp.ok(v_positions = 'T3,T4,T5', '2a waiting order after boarding is T3, T4, T5');
end $$;

-- 3. An unscheduled bus (never released) serves the queue the same way --------------------
do $$
declare r jsonb := mark_bus_arrived('R4-02', 'manual');
begin
  perform pg_temp.ok((r->>'unscheduled')::boolean, '3a R4-02 arrived without a release');
  perform pg_temp.ok((r->>'boarded_count')::int = 3, '3b and boarded the 3 remaining tickets');
  perform pg_temp.ok(pg_temp.st('T5') = 'boarded' and pg_temp.bus_of('T5') = 'R4-02', '3c T5 is on R4-02');
end $$;

-- 4. A full bus boards nobody ------------------------------------------------------------
do $$
declare r jsonb;
begin
  -- R4-02 leaves first: a bus still parked with free places would take T6 straight away.
  perform complete_trip('R4-02', 'dashboard');
  insert into t values ('T6', create_token('STOP-01', 'DTN', 'FIFO-6', 'gesture', 1)->>'code');
  perform complete_trip('R4-01', 'dashboard');
  update buses set occupancy = 70 where id = 'R4-01';
  r := mark_bus_arrived('R4-01', 'dashboard');
  perform pg_temp.ok((r->>'boarded_count')::int = 0 and pg_temp.st('T6') = 'waiting', '4a full bus leaves T6 waiting');
  perform complete_trip('R4-01', 'dashboard');
  update buses set occupancy = 0 where destination = 'DTN';
  perform pg_temp.ok(pg_temp.st('T0') = 'completed', '4b riders complete back at the terminal');
end $$;

-- 5. Boarding along the route only takes that stop's tickets for that route --------------
do $$
declare r jsonb;
begin
  insert into t values ('B1', create_token('STOP-16', 'DTN', 'FIFO-B1', 'gesture', 1)->>'code');  -- Biryogo, on R4
  insert into t values ('B2', create_token('STOP-16', 'DTN', 'FIFO-B2', 'gesture', 1)->>'code');
  insert into t values ('BR', create_token('STOP-16', 'REM', 'FIFO-BR', 'gesture', 1)->>'code');  -- other route
  insert into t values ('G1', create_token('STOP-03', 'DTN', 'FIFO-G1', 'gesture', 1)->>'code');  -- not on R4
  update buses set status = 'on_the_way', released_at = now() where id = 'R4-01';
  r := update_bus_location('R4-01', -1.9618, 30.0560, 6, 8);                                   -- at Biryogo
  perform pg_temp.ok(r->>'at_stop' = 'STOP-16' and (r->>'boarded_count')::int = 2, '5a at Biryogo boards 2');
  perform pg_temp.ok(pg_temp.st('B1') = 'boarded' and pg_temp.st('B2') = 'boarded', '5b both Biryogo DTN tickets boarded');
  perform pg_temp.ok(pg_temp.st('BR') = 'waiting', '5c the Remera ticket at Biryogo is left');
  perform pg_temp.ok(pg_temp.st('T6') = 'waiting', '5d the kiosk queue is untouched until the kiosk');
  perform pg_temp.ok(exists (select 1 from bus_events where bus_id = 'R4-01' and event = 'boarded'
                             and stop_id = 'STOP-16' and boarded_count = 2), '5e a boarded event is logged at STOP-16');
  r := update_bus_location('R4-01', -1.9618, 30.0560, 0, 8);                                    -- still there
  perform pg_temp.ok((r->>'boarded_count')::int = 0, '5f staying at the stop boards nobody twice');
end $$;

-- 6. Dispatch counts only tickets at stops the route serves --------------------------------
do $$
declare v_waiting int;
begin
  perform complete_trip('R4-01', 'dashboard');
  perform run_dispatch();
  select waiting into v_waiting from dispatch_decisions where destination = 'DTN' and status = 'pending';
  -- T6 at the kiosk counts; G1 at Giporoso (not on R4) does not.
  perform pg_temp.ok(v_waiting = 1, '6a DTN waiting = 1 (kiosk), the Giporoso ticket is ignored');
end $$;

-- 7. A bus parked at its terminal without a release doesn't board there -------------------
do $$
declare r jsonb;
begin
  insert into t values ('N1', create_token('STOP-06', 'DTN', 'FIFO-N1', 'gesture', 1)->>'code');  -- R4 terminal
  r := update_bus_location('R4-02', -1.9796, 30.0446, 0, 8);
  perform pg_temp.ok(pg_temp.st('N1') = 'waiting', '7a parked unreleased bus boards nobody at the terminal');
  update buses set status = 'on_the_way', released_at = now() where id = 'R4-02';
  r := update_bus_location('R4-02', -1.9796, 30.0446, 0, 8);
  perform pg_temp.ok(pg_temp.st('N1') = 'boarded', '7b once released it boards the terminal queue');
  r := update_bus_location('R4-02', -1.9441, 30.0619, 4, 8);                                    -- at the kiosk
  perform pg_temp.ok(r->>'status' = 'arrived' and pg_temp.st('T6') = 'boarded', '7c GPS arrival at the kiosk boards T6');
  perform complete_trip('R4-02', 'gps');
end $$;

-- 8. auto_dispatch: off does nothing, on releases within the hourly limit -----------------
do $$
declare v_released int;
begin
  update config set value = 1 where key = 'release_load_pct';
  insert into t values ('A1', create_token('STOP-01', 'DTN', 'FIFO-A1', 'gesture', 1)->>'code');
  perform run_dispatch();
  perform pg_temp.ok(not exists (select 1 from buses where destination = 'DTN' and status = 'on_the_way'),
                     '8a auto_dispatch off: recommendation only');

  update config set value = 1 where key = 'auto_dispatch';
  update config set value = 1 where key = 'max_auto_releases_per_hour';
  perform run_dispatch();
  select count(*) into v_released from bus_events e join buses b on b.id = e.bus_id
   where b.destination = 'DTN' and e.event = 'released' and e.source = 'auto';
  perform pg_temp.ok(v_released = 1, '8b auto_dispatch on: one bus released by itself');

  -- That bus is full, so a second one is recommended, but the hourly limit (1) is reached.
  update buses set occupancy = 70 where destination = 'DTN' and status = 'on_the_way';
  perform run_dispatch();
  select count(*) into v_released from bus_events e join buses b on b.id = e.bus_id
   where b.destination = 'DTN' and e.event = 'released' and e.source = 'auto';
  perform pg_temp.ok(v_released = 1 and exists (select 1 from dispatch_decisions
                     where destination = 'DTN' and status = 'pending' and action = 'release'),
                     '8c limit reached: the second release waits for HQ');

  update config set value = 2 where key = 'max_auto_releases_per_hour';
  perform run_dispatch();
  select count(*) into v_released from bus_events e join buses b on b.id = e.bus_id
   where b.destination = 'DTN' and e.event = 'released' and e.source = 'auto';
  perform pg_temp.ok(v_released = 2, '8d limit raised to 2: the second bus goes');
end $$;

select n, check_name as passed from results order by n;

rollback;
