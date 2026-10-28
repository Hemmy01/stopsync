-- RLS, Realtime and scheduling. See CLAUDE.md section 8, "Platform setup".

-- PROTOTYPE ONLY: anyone with the anon key can read and write every table.
-- Production needs real auth and per-role policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'stops', 'destinations', 'queue_tokens', 'buses',
    'bus_events', 'dispatch_decisions', 'config'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy prototype_open_access on public.%I
         for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end;
$$;

alter publication supabase_realtime add table
  public.queue_tokens,
  public.buses,
  public.dispatch_decisions,
  public.bus_events,
  public.config;

-- Recompute dispatch recommendations every minute.
create extension if not exists pg_cron;

select cron.schedule('stopsync-run-dispatch', '* * * * *', 'select public.run_dispatch()');
