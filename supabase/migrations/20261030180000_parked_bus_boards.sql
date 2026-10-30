-- A bus parked at the stop (arrived, not yet reset) also takes tickets made while it waits,
-- if it has free places. Before this, a ticket made after the bus arrived waited for the next
-- bus even though this one was standing there with seats. Boarding goes through board_queue,
-- so order (oldest first), the per-route lock and the seat limit stay exactly as on arrival.

-- Internal: board the stop's queue onto the first parked bus for this route that has room.
create function public.board_parked_bus(p_dest text, p_stop text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bus   text;
  v_board jsonb;
begin
  -- The bus that arrived first goes first.
  for v_bus in
    select b.id
      from buses b
     where b.destination = p_dest and b.status = 'arrived' and b.last_stop_id = p_stop
     order by (select max(e.created_at) from bus_events e where e.bus_id = b.id and e.event = 'arrived'), b.id
  loop
    v_board := board_queue(v_bus, p_stop);
    if coalesce((v_board->>'boarded_count')::int, 0) > 0 then
      return v_board || jsonb_build_object('bus_id', v_bus);
    end if;
  end loop;
  return null;
end;
$$;

revoke execute on function public.board_parked_bus(text, text) from public, anon, authenticated;

-- Same role check as before; a new ticket is then offered to a parked bus. The result gains
-- "boarded_bus" when that happened.
create or replace function public.create_token(p_stop text, p_dest text, p_card text, p_method text, p_conf numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_board  jsonb;
begin
  perform require_role(has_role('kiosk'));
  v_result := private.create_token(p_stop, p_dest, p_card, p_method, p_conf);
  if v_result->>'status' = 'created' then
    v_board := board_parked_bus(p_dest, p_stop);
    if v_board is not null then
      v_result := v_result || jsonb_build_object('boarded_bus', v_board->>'bus_id');
    end if;
  end if;
  return v_result;
end $$;
