-- Cancellation scenarios (Phase 6). Runs in one transaction and ALWAYS rolls back.

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
  r      jsonb;
  v_code text := create_token('STOP-01', 'REM', 'CANCEL-1', 'voice', 0.9)->>'code';
  v_next text := create_token('STOP-01', 'REM', 'CANCEL-2', 'voice', 0.9)->>'code';
begin
  r := cancel_token('CANCEL-1', 'not_a_reason');
  perform pg_temp.ok(r->>'status' = 'error', '1 an unknown reason is refused');
  perform pg_temp.ok((select status from queue_tokens where code = v_code and card_id = 'CANCEL-1') = 'waiting',
                     '2 and the ticket keeps its place');

  r := cancel_token('CANCEL-1', 'waited_too_long');
  perform pg_temp.ok(r->>'status' = 'cancelled' and r->>'code' = v_code, '3 cancel returns the ticket code');
  perform pg_temp.ok(exists (select 1 from queue_tokens where card_id = 'CANCEL-1' and status = 'cancelled'
                             and cancel_reason = 'waited_too_long' and cancelled_at is not null),
                     '4 the ticket is cancelled with its reason and time');

  r := cancel_token('CANCEL-1', 'other');
  perform pg_temp.ok(r->>'status' = 'not_found', '5 cancelling twice finds nothing');

  r := create_token('STOP-01', 'NYA', 'CANCEL-1', 'gesture', 1);
  perform pg_temp.ok(r->>'status' = 'created', '6 the card can queue again after cancelling');

  perform mark_bus_arrived('R2-01', 'dashboard');
  perform pg_temp.ok((select status from queue_tokens where code = v_next and card_id = 'CANCEL-2') = 'boarded',
                     '7 the next passenger moves up and boards; the cancelled one does not');
  perform pg_temp.ok(not exists (select 1 from queue_tokens where card_id = 'CANCEL-1' and code = v_code and bus_id is not null),
                     '8 a cancelled ticket is never boarded');

  r := cancel_token('CANCEL-2', 'other');
  perform pg_temp.ok(r->>'status' = 'not_found', '9 a boarded ticket cannot be cancelled');
end $$;

select n, check_name as passed from results order by n;

rollback;
