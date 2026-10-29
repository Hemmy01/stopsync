-- User roles with Supabase Auth (Phase 7). Replaces the open prototype access.
--
-- Roles live in public.profiles and are checked in the database:
--   kiosk       create_token, cancel_token, log_selection
--   driver      update_bus_location, adjust_occupancy, mark_bus_arrived, complete_trip: own bus only
--   dispatcher  approve/dismiss, mark arrived, complete trip, reset bus, run_dispatch
--   admin       everything, incl. config, reset_demo and set_user_role
--   viewer      read-only
-- Every signed-in role can read the operational tables; signed-out (anon) can read nothing.
-- Calls without a login token (pg_cron, SQL editor, CLI) are trusted, so cron and the SQL
-- scenario tests keep working.

-- 1. Profiles ------------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,
  role       text not null default 'viewer'
             check (role in ('admin', 'dispatcher', 'driver', 'kiosk', 'viewer')),
  bus_id     text references public.buses(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Demo accounts get their role on sign-up; everyone else starts as viewer.
create function public.demo_role_for(p_email text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(p_email)
    when 'admin@tapselect.demo'      then 'admin'
    when 'dispatcher@tapselect.demo' then 'dispatcher'
    when 'driver@tapselect.demo'     then 'driver'
    when 'kiosk@tapselect.demo'      then 'kiosk'
    else 'viewer'
  end
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, bus_id)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    demo_role_for(new.email),
    case when lower(new.email) = 'driver@tapselect.demo' then 'R2-01' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users created before this migration.
insert into public.profiles (id, email, name, role, bus_id)
select u.id, u.email, split_part(u.email, '@', 1), public.demo_role_for(u.email),
       case when lower(u.email) = 'driver@tapselect.demo' then 'R2-01' end
  from auth.users u
on conflict (id) do nothing;

-- 2. Role helpers --------------------------------------------------------------------------

-- No login token at all: pg_cron, the SQL editor or the CLI, never a browser.
create function public.is_trusted_caller()
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(current_setting('request.jwt.claims', true), '') = '' then true
    else coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role'
  end
$$;

-- The signed-in user's role, or null when signed out.
create function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

-- True for the listed roles and for admin (and for trusted callers).
create function public.has_role(variadic p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_trusted_caller()
      or coalesce((select role = 'admin' or role = any(p_roles) from profiles where id = auth.uid()), false)
$$;

-- The signed-in driver drives this bus (admin and trusted callers count too).
create function public.drives_bus(p_bus text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_trusted_caller()
      or coalesce((select role = 'admin' or (role = 'driver' and bus_id = p_bus) from profiles where id = auth.uid()), false)
$$;

create function public.require_role(p_allowed boolean)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if not coalesce(p_allowed, false) then
    raise exception 'Your account (%) is not allowed to do this', coalesce(app_role(), 'signed out')
      using errcode = '42501';
  end if;
end;
$$;

-- 3. Role checks on the functions ------------------------------------------------------------
-- The original bodies move to the private schema (not exposed by the API); a wrapper with the
-- same signature checks the role first. Internal calls use the public names, so they are
-- checked too (a driver's GPS arrival is checked as "drives this bus", which passes).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter function public.create_token(text, text, text, text, numeric) set schema private;
alter function public.cancel_token(text, text) set schema private;
alter function public.log_selection(text, text, text, numeric, text, text) set schema private;
alter function public.update_bus_location(text, double precision, double precision, double precision, double precision) set schema private;
alter function public.adjust_occupancy(text, integer) set schema private;
alter function public.mark_bus_arrived(text, text) set schema private;
alter function public.complete_trip(text, text) set schema private;
alter function public.approve_decision(bigint) set schema private;
alter function public.dismiss_decision(bigint) set schema private;
alter function public.reset_bus(text) set schema private;
alter function public.run_dispatch() set schema private;
alter function public.reset_demo() set schema private;

create function public.create_token(p_stop text, p_dest text, p_card text, p_method text, p_conf numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_role(has_role('kiosk'));
  return private.create_token(p_stop, p_dest, p_card, p_method, p_conf);
end $$;

create function public.cancel_token(p_card text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_role(has_role('kiosk'));
  return private.cancel_token(p_card, p_reason);
end $$;

create function public.log_selection(p_stop text, p_dest text, p_method text, p_conf numeric, p_outcome text, p_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_role(has_role('kiosk'));
  return private.log_selection(p_stop, p_dest, p_method, p_conf, p_outcome, p_token);
end $$;

create function public.update_bus_location(p_bus text, p_lat double precision, p_lng double precision, p_speed double precision, p_accuracy double precision)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_role(drives_bus(p_bus));
  return private.update_bus_location(p_bus, p_lat, p_lng, p_speed, p_accuracy);
end $$;

create function public.adjust_occupancy(p_bus text, p_delta integer)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_role(drives_bus(p_bus));
  return private.adjust_occupancy(p_bus, p_delta);
end $$;

create function public.mark_bus_arrived(p_bus text, p_source text default 'manual')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_role(has_role('dispatcher') or drives_bus(p_bus));
  return private.mark_bus_arrived(p_bus, p_source);
end $$;

create function public.complete_trip(p_bus text, p_source text default 'manual')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_role(has_role('dispatcher') or drives_bus(p_bus));
  return private.complete_trip(p_bus, p_source);
end $$;

create function public.approve_decision(p_decision bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_role(has_role('dispatcher'));
  return private.approve_decision(p_decision);
end $$;

create function public.dismiss_decision(p_decision bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_role(has_role('dispatcher'));
  return private.dismiss_decision(p_decision);
end $$;

create function public.reset_bus(p_bus text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_role(has_role('dispatcher'));
  return private.reset_bus(p_bus);
end $$;

create function public.run_dispatch()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_role(has_role('dispatcher'));
  perform private.run_dispatch();
end $$;

create function public.reset_demo()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_role(has_role('admin'));
  return private.reset_demo();
end $$;

-- 4. New functions -----------------------------------------------------------------------------

-- Admin: change a user's role (and a driver's bus). Admins can't change their own role,
-- so the last admin can't lock everyone out by accident.
create function public.set_user_role(p_user uuid, p_role text, p_bus text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform require_role(has_role('admin'));
  if p_role not in ('admin', 'dispatcher', 'driver', 'kiosk', 'viewer') then
    return jsonb_build_object('status', 'error', 'message', 'Unknown role');
  end if;
  if p_user = auth.uid() then
    return jsonb_build_object('status', 'error', 'message', 'You can''t change your own role');
  end if;
  if p_role = 'driver' and not exists (select 1 from buses where id = p_bus) then
    return jsonb_build_object('status', 'error', 'message', 'Choose the driver''s bus');
  end if;

  update profiles
     set role = p_role, bus_id = case when p_role = 'driver' then p_bus end
   where id = p_user;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'No such user');
  end if;
  return jsonb_build_object('status', 'ok', 'role', p_role, 'bus_id', case when p_role = 'driver' then p_bus end);
end;
$$;

-- Simulator (kiosk role): expire waiting tickets at the simulated stops, never at the kiosk.
create function public.expire_waiting_tokens(p_stops text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform require_role(has_role('kiosk'));
  update queue_tokens set status = 'expired'
   where status = 'waiting' and stop_id = any(p_stops) and stop_id <> kiosk_stop_id();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 5. Grants: signed-in users only ----------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.create_token(text, text, text, text, numeric),
  public.cancel_token(text, text),
  public.log_selection(text, text, text, numeric, text, text),
  public.update_bus_location(text, double precision, double precision, double precision, double precision),
  public.update_bus_location(text, double precision, double precision),
  public.adjust_occupancy(text, integer),
  public.mark_bus_arrived(text, text),
  public.complete_trip(text, text),
  public.approve_decision(bigint),
  public.dismiss_decision(bigint),
  public.reset_bus(text),
  public.run_dispatch(),
  public.reset_demo(),
  public.set_user_role(uuid, text, text),
  public.expire_waiting_tokens(text[]),
  public.app_role(),
  public.has_role(text[]),
  public.drives_bus(text),
  public.require_role(boolean),
  public.is_trusted_caller(),
  public.demo_role_for(text),
  public.config_value(text, numeric),
  public.haversine_m(double precision, double precision, double precision, double precision),
  public.kiosk_stop_id(),
  public.route_progress(text, double precision, double precision),
  public.bus_free_places(public.buses)
to authenticated;

-- Internal only (called by other functions or pg_cron).
revoke execute on function
  public.board_queue(text, text),
  public.release_for_decision(bigint, text),
  public.prune_bus_positions(),
  public.handle_new_user()
from authenticated;

-- 6. Row level security: role-based, replacing prototype_open_access ------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'stops', 'destinations', 'queue_tokens', 'buses', 'bus_events', 'dispatch_decisions', 'config',
    'selection_events', 'bus_positions', 'routes_stops', 'terminals', 'cancel_reasons'
  ] loop
    execute format('drop policy if exists prototype_open_access on public.%I', t);
    execute format(
      'create policy signed_in_read on public.%I for select to authenticated using ((select public.app_role()) is not null)', t);
    execute format(
      'create policy admin_write on public.%I for all to authenticated using ((select public.has_role(''admin''))) with check ((select public.has_role(''admin'')))', t);
  end loop;
end $$;

-- Profiles: you see your own; admins see everyone. Changes go through set_user_role.
alter table public.profiles enable row level security;
create policy own_or_admin_read on public.profiles for select to authenticated
  using (id = auth.uid() or (select public.has_role('admin')));

alter publication supabase_realtime add table public.profiles;
