-- StopSync v2: model mapping on destinations, selection outcomes, demo reset
-- and per-method model insights. See CLAUDE.md sections 3 and 8 (v2 additions).

-- 1. Final four destinations -------------------------------------------------
-- Any destination outside the final four (the old placeholder) is folded into
-- DTN: its buses, tokens and decisions move over, then it is deleted.
do $$
declare
  old_code text;
begin
  for old_code in
    select code from public.destinations where code not in ('NYA', 'REM', 'KIM', 'DTN')
  loop
    insert into public.destinations (code, name, route, sort_order)
    values ('DTN', 'Downtown', 'R4', 4)
    on conflict (code) do nothing;

    update public.buses set destination = 'DTN' where destination = old_code;
    update public.queue_tokens set destination = 'DTN' where destination = old_code;
    update public.dispatch_decisions set destination = 'DTN' where destination = old_code;
    delete from public.destinations where code = old_code;
  end loop;
end;
$$;

-- 2. How each stop is chosen on the board -------------------------------------
alter table public.destinations
  add column voice_label   text,
  add column gesture_label text,
  add column gesture_hint  text;

update public.destinations d
   set voice_label = m.voice_label, gesture_label = m.gesture_label, gesture_hint = m.gesture_hint
  from (values
    ('REM', 'remera',    'one_tap',    'Tap once'),
    ('DTN', 'downtown',  'two_taps',   'Tap twice'),
    ('NYA', 'nyabugogo', 'three_taps', 'Tap 3 times'),
    ('KIM', 'kimironko', 'hold',       'Hold your hand still')
  ) as m(code, voice_label, gesture_label, gesture_hint)
 where d.code = m.code;

-- 3. Selection outcomes (how well the models work in practice) ----------------
create table public.selection_events (
  id          bigint generated always as identity primary key,
  stop_id     text not null references public.stops(id),
  destination text not null references public.destinations(code),
  method      text not null check (method in ('voice', 'gesture', 'manual')),
  confidence  numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  outcome     text not null check (outcome in ('confirmed', 'changed', 'cancelled', 'timeout')),
  token_code  text,
  created_at  timestamptz not null default now()
);

create index selection_events_created on public.selection_events (created_at);

-- PROTOTYPE ONLY, like every other table: see the README.
alter table public.selection_events enable row level security;
create policy prototype_open_access on public.selection_events
  for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table public.selection_events;

create or replace function public.log_selection(
  p_stop text, p_dest text, p_method text, p_conf numeric, p_outcome text, p_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into selection_events (stop_id, destination, method, confidence, outcome, token_code)
  values (p_stop, p_dest, p_method, p_conf, p_outcome, p_token)
  returning id into v_id;
  return jsonb_build_object('status', 'logged', 'id', v_id);
exception
  when check_violation or foreign_key_violation then
    return jsonb_build_object('status', 'error', 'message', sqlerrm);
end;
$$;

-- 4. Reset the demo to a clean slate ------------------------------------------
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

  update buses
     set status = 'at_terminal', eta_minutes = null, released_at = null,
         lat = null, lng = null, location_updated_at = null
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

revoke execute on function
  public.log_selection(text, text, text, numeric, text, text),
  public.reset_demo()
from public;

grant execute on function
  public.log_selection(text, text, text, numeric, text, text),
  public.reset_demo()
to anon, authenticated;

-- 5. Model insights for today (Kigali time) -----------------------------------
create view public.model_insights_today
with (security_invoker = on) as
select
  method,
  count(*)::int                                                        as selections,
  count(*) filter (where outcome = 'confirmed')::int                   as confirmed,
  count(*) filter (where outcome = 'changed')::int                     as changed,
  count(*) filter (where outcome in ('cancelled', 'timeout'))::int     as cancelled_or_timeout,
  round(100.0 * count(*) filter (where outcome = 'confirmed') / count(*), 1) as confirmation_rate,
  round(avg(confidence), 3)                                            as avg_confidence
from public.selection_events
where created_at >= (date_trunc('day', now() at time zone 'Africa/Kigali') at time zone 'Africa/Kigali')
group by method;

grant select on public.model_insights_today to anon, authenticated;
