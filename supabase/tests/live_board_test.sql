-- Public Live board: anyone can read it, and it leaks nothing private. Always rolls back.

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
select private.create_token('STOP-01', 'REM', 'LIVE-SECRET-CARD', 'voice', 0.9);

do $$
declare
  v jsonb;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  v := live_board();
  reset role;
  perform set_config('request.jwt.claims', '', true);

  perform pg_temp.ok(v->'stop'->>'id' = 'STOP-01', '1 signed out: the board names the kiosk stop');
  perform pg_temp.ok(jsonb_array_length(v->'buses') = (select count(*) from buses), '2 every bus is listed');
  perform pg_temp.ok(jsonb_array_length(v->'routes') >= 4, '3 the routes come with it for the map');
  perform pg_temp.ok((v->'network_waiting'->>'REM')::int >= 1, '4 waiting counts per route');
  perform pg_temp.ok(exists (select 1 from jsonb_array_elements(v->'tokens') t where t->>'destination' = 'REM'),
                     '5 the kiosk queue is shown by ticket code');
  perform pg_temp.ok(position('LIVE-SECRET-CARD' in v::text) = 0, '6 card ids never appear');
  perform pg_temp.ok(position('confidence' in v::text) = 0 and position('method' in v::text) = 0,
                     '7 nor how passengers chose');
  perform pg_temp.ok(position('tapselect.demo' in v::text) = 0, '8 nor any account');
end $$;

do $$
declare
  r text;
begin
  -- Tables stay closed to anon even with the board open.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*)::text into r from queue_tokens;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.ok(r = '0', '9 queue_tokens is still unreadable signed out');
end $$;

select n, check_name as passed from results order by n;

rollback;
