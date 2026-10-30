-- A driver picks the bus they drive this shift (the /bus page), instead of an admin linking
-- it. One bus at a time per driver and one driver per bus; drives_bus() still limits GPS,
-- occupancy and arrival to that one bus. Admins keep set_user_role for assigning drivers.

-- Buses already linked to another driver, so the picker can show them as taken.
create function public.taken_buses()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(bus_id order by bus_id), '{}')
    from profiles
   where role = 'driver' and bus_id is not null and id is distinct from auth.uid()
$$;

create function public.choose_my_bus(p_bus text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform require_role(app_role() is not distinct from 'driver');
  if not exists (select 1 from buses where id = p_bus) then
    return jsonb_build_object('status', 'error', 'message', 'Bus not found');
  end if;
  -- Two drivers picking the same bus at once: one waits for the other.
  perform pg_advisory_xact_lock(hashtext('choose_my_bus:' || p_bus));
  if exists (select 1 from profiles where role = 'driver' and bus_id = p_bus and id <> auth.uid()) then
    return jsonb_build_object('status', 'taken', 'message', 'Another driver is on ' || p_bus);
  end if;
  update profiles set bus_id = p_bus where id = auth.uid();
  return jsonb_build_object('status', 'ok', 'bus_id', p_bus);
end;
$$;

revoke execute on function public.taken_buses() from public, anon;
revoke execute on function public.choose_my_bus(text) from public, anon;
grant execute on function public.taken_buses() to authenticated;
grant execute on function public.choose_my_bus(text) to authenticated;
