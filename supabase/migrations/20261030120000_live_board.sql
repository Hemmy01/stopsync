-- Public, read-only Live board (/live): the audience follows the demo on their phones
-- without signing in. One function returns exactly what the board shows and nothing else:
-- no card ids, no selection methods, no profiles, no config. Tables stay closed to anon.

create function public.live_board()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'stop', (select jsonb_build_object('id', s.id, 'name', s.name) from stops s where s.id = kiosk_stop_id()),
    'buses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'destination', b.destination, 'status', b.status,
        'lat', b.lat, 'lng', b.lng, 'location_updated_at', b.location_updated_at,
        'released_at', b.released_at, 'departed_at', b.departed_at, 'eta_minutes', b.eta_minutes,
        'seats', b.seats, 'standing', b.standing, 'occupancy', b.occupancy,
        'last_stop_id', b.last_stop_id, 'next_stop_id', b.next_stop_id,
        'stops_remaining', b.stops_remaining, 'distance_remaining_m', b.distance_remaining_m
      ) order by b.id)
      from buses b), '[]'::jsonb),
    -- The kiosk's queue, by ticket code only (what the kiosk screen already shows publicly).
    'tokens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'code', q.code, 'destination', q.destination, 'status', q.status,
        'bus_id', q.bus_id, 'created_at', q.created_at
      ) order by q.created_at, q.id)
      from queue_tokens q
      where q.stop_id = kiosk_stop_id()
        and (q.status = 'waiting' or (q.status = 'boarded' and q.bus_id is not null))), '[]'::jsonb),
    -- Waiting along each route (the stops it serves), as dispatch counts it.
    'network_waiting', coalesce((
      select jsonb_object_agg(d.code, (
        select count(*) from queue_tokens q
         where q.destination = d.code and q.status = 'waiting'
           and q.stop_id in (select rs.stop_id from routes_stops rs where rs.route = d.route)))
      from destinations d), '{}'::jsonb),
    'routes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'route', r.route,
        'terminal_radius_m', coalesce((select t.radius_m from terminals t where t.route = r.route), 150),
        'stops', (select jsonb_agg(jsonb_build_object(
                    'id', s.id, 'name', s.name, 'lat', s.lat, 'lng', s.lng,
                    'distance_m', rs.distance_from_terminal_m) order by rs.seq)
                    from routes_stops rs join stops s on s.id = rs.stop_id
                   where rs.route = r.route and s.lat is not null and s.lng is not null)
      ) order by r.route)
      from (select distinct route from routes_stops) r), '[]'::jsonb),
    'updated_at', now()
  )
$$;

revoke execute on function public.live_board() from public;
grant execute on function public.live_board() to anon, authenticated;
