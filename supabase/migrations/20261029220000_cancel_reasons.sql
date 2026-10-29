-- Passenger cancellation with reasons (Phase 6 of the judges' feedback round).
-- 'completed' already exists (Phase 4); this adds 'cancelled', the reason and when.

create table public.cancel_reasons (
  code       text primary key,
  label      text not null,
  sort_order int  not null default 0
);

insert into public.cancel_reasons (code, label, sort_order) values
  ('waited_too_long',     'Waited too long',                    1),
  ('other_transport',     'Took another transport (moto/taxi)', 2),
  ('changed_destination', 'Changed my destination',             3),
  ('wrong_stop',          'Chose the wrong stop',               4),
  ('emergency',           'Emergency or personal reason',       5),
  ('other',               'Other',                              6)
on conflict (code) do update set label = excluded.label, sort_order = excluded.sort_order;

alter table public.queue_tokens
  add column cancel_reason text references public.cancel_reasons(code),
  add column cancelled_at  timestamptz;

alter table public.queue_tokens drop constraint queue_tokens_status_check;
alter table public.queue_tokens add constraint queue_tokens_status_check
  check (status in ('waiting', 'boarded', 'completed', 'cancelled', 'expired'));

-- PROTOTYPE ONLY, like every other table (see 20261027170200_platform.sql).
alter table public.cancel_reasons enable row level security;
create policy prototype_open_access on public.cancel_reasons
  for all to anon, authenticated using (true) with check (true);

-- The passenger gives up their place: only a waiting ticket, and only with a known reason.
create or replace function public.cancel_token(p_card text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token queue_tokens%rowtype;
begin
  if not exists (select 1 from cancel_reasons where code = p_reason) then
    return jsonb_build_object('status', 'error', 'message', 'Unknown reason');
  end if;

  select * into v_token
    from queue_tokens
   where card_id = p_card and status = 'waiting'
   for update;
  if not found then
    -- Boarded, cancelled already, or never queued.
    return jsonb_build_object('status', 'not_found', 'message', 'This card has no place in the queue');
  end if;

  update queue_tokens
     set status = 'cancelled', cancel_reason = p_reason, cancelled_at = now()
   where id = v_token.id;

  return jsonb_build_object(
    'status', 'cancelled', 'code', v_token.code, 'destination', v_token.destination, 'reason', p_reason
  );
end;
$$;

revoke execute on function public.cancel_token(text, text) from public;
grant execute on function public.cancel_token(text, text) to anon, authenticated;
