-- A parked bus takes tickets made while it waits, within its free places. Always rolls back.

begin;

create temp table results (n serial, check_name text);

create function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAILED: %', p_name;
  end if;
  insert into results (check_name) values (p_name);
end $$;

update queue_tokens set status = 'expired' where status = 'waiting';
update buses set status = 'at_terminal', occupancy = 0;

do $$
declare
  r jsonb;
begin
  perform mark_bus_arrived('R2-01', 'dashboard');

  r := create_token('STOP-01', 'REM', 'PARK-1', 'voice', 0.9);
  perform pg_temp.ok(r->>'status' = 'created' and r->>'boarded_bus' = 'R2-01', '1 a ticket made while R2-01 is parked boards it');
  perform pg_temp.ok((select status = 'boarded' and bus_id = 'R2-01' from queue_tokens where card_id = 'PARK-1'),
                     '2 the ticket is boarded on R2-01');
  perform pg_temp.ok((select occupancy from buses where id = 'R2-01') = 1, '3 and the bus counts one more on board');

  r := create_token('STOP-01', 'NYA', 'PARK-2', 'voice', 0.9);
  perform pg_temp.ok(r->>'boarded_bus' is null and (select status from queue_tokens where card_id = 'PARK-2') = 'waiting',
                     '4 another route''s ticket keeps waiting');

  update buses set occupancy = seats + standing where id = 'R2-01';
  r := create_token('STOP-01', 'REM', 'PARK-3', 'voice', 0.9);
  perform pg_temp.ok(r->>'boarded_bus' is null and (select status from queue_tokens where card_id = 'PARK-3') = 'waiting',
                     '5 a full parked bus takes nobody');

  perform mark_bus_arrived('R2-02', 'dashboard');
  perform pg_temp.ok((select bus_id from queue_tokens where card_id = 'PARK-3') = 'R2-02',
                     '6 the next bus to arrive takes the waiting ticket first');
  r := create_token('STOP-01', 'REM', 'PARK-4', 'voice', 0.9);
  perform pg_temp.ok(r->>'boarded_bus' = 'R2-02', '7 with R2-01 full, a new ticket boards the other parked bus');

  update buses set status = 'on_the_way' where destination = 'REM';
  r := create_token('STOP-01', 'REM', 'PARK-5', 'voice', 0.9);
  perform pg_temp.ok(r->>'boarded_bus' is null and (select status from queue_tokens where card_id = 'PARK-5') = 'waiting',
                     '8 no parked bus: the ticket waits as before');

  update buses set status = 'arrived', last_stop_id = 'STOP-01', occupancy = 0 where id = 'R2-01';
  r := create_token('STOP-02', 'REM', 'PARK-6', 'rfid', null);
  perform pg_temp.ok(r->>'boarded_bus' is null, '9 a bus parked at the kiosk does not take tickets from another stop');

  r := create_token('STOP-01', 'REM', 'PARK-7', 'voice', 0.9);
  perform pg_temp.ok(r->>'boarded_bus' = 'R2-01' and (select status from queue_tokens where card_id = 'PARK-5') = 'boarded',
                     '10 first come first served: the older waiting ticket boards too, before the new one');

  perform pg_temp.ok(not has_function_privilege('authenticated', 'public.board_parked_bus(text, text)', 'execute')
                     and not has_function_privilege('anon', 'public.board_parked_bus(text, text)', 'execute'),
                     '11 board_parked_bus is internal only');
end $$;

select n, check_name as passed from results order by n;

rollback;
