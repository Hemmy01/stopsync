-- Tapping a stop on screen has no ML confidence: let callers omit p_conf.
-- Only adds a default; behaviour is unchanged.
create or replace function public.create_token(
  p_stop text, p_dest text, p_card text, p_method text, p_conf numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing  queue_tokens%rowtype;
  v_route     text;
  v_day_start timestamptz;
  v_seq       int;
  v_code      text;
  v_id        bigint;
  v_position  int;
begin
  if p_card is not null then
    select * into v_existing
      from queue_tokens
     where card_id = p_card and status = 'waiting'
     limit 1;
    if found then
      return jsonb_build_object(
        'status', 'duplicate',
        'code', v_existing.code,
        'destination', v_existing.destination
      );
    end if;
  end if;

  select route into v_route from destinations where code = p_dest;
  if v_route is null then
    return jsonb_build_object('status', 'error', 'message', 'Unknown destination');
  end if;

  -- Serialise numbering per destination so two taps never get the same code.
  perform pg_advisory_xact_lock(hashtext('create_token:' || p_dest));

  v_day_start := date_trunc('day', now() at time zone 'Africa/Kigali')
                   at time zone 'Africa/Kigali';

  select count(*) + 1 into v_seq
    from queue_tokens
   where destination = p_dest and created_at >= v_day_start;

  v_code := v_route || '-' || lpad(v_seq::text, 3, '0');

  begin
    insert into queue_tokens (code, stop_id, destination, card_id, method, confidence)
    values (v_code, p_stop, p_dest, p_card, p_method, p_conf)
    returning id into v_id;
  exception when unique_violation then
    -- The same card was tapped twice at the same instant.
    select * into v_existing
      from queue_tokens
     where card_id = p_card and status = 'waiting'
     limit 1;
    return jsonb_build_object(
      'status', 'duplicate',
      'code', v_existing.code,
      'destination', v_existing.destination
    );
  end;

  select count(*) into v_position
    from queue_tokens
   where destination = p_dest and status = 'waiting' and id <= v_id;

  return jsonb_build_object(
    'status', 'created',
    'code', v_code,
    'destination', p_dest,
    'position', v_position
  );
end;
$$;
