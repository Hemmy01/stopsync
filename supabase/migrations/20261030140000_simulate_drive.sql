-- "Simulate drive" (dashboard, presentation aid): a dispatcher moves a released bus along its
-- route without a phone. Each step goes through the same update_bus_location logic as real
-- GPS (departure, boarding along the route, ETA, arrival at the kiosk). Only for a bus that
-- is on the way; the dashboard marks the bus as simulated while it runs.

create function public.simulate_bus_position(p_bus text, p_lat double precision, p_lng double precision)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform require_role(has_role('dispatcher'));
  select status into v_status from buses where id = p_bus;
  if v_status is null then
    return jsonb_build_object('status', 'error', 'message', 'Bus not found');
  end if;
  if v_status <> 'on_the_way' then
    return jsonb_build_object('status', 'error', 'message', 'Only a bus on the way can be simulated');
  end if;
  -- Speed unknown (the ETA uses avg_bus_speed_kmh); accuracy as good as a phone outdoors.
  return private.update_bus_location(p_bus, p_lat, p_lng, null, 5);
end;
$$;

revoke execute on function public.simulate_bus_position(text, double precision, double precision) from public, anon;
grant execute on function public.simulate_bus_position(text, double precision, double precision) to authenticated;
