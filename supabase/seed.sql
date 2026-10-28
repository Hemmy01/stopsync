-- StopSync demo seed. Safe to run more than once.
-- Destinations live here and in apps/web/lib/destinations.ts only.

insert into public.stops (id, name, lat, lng) values
  ('STOP-01', 'Kiosk 1 (Demo)', -1.9441, 30.0619)
on conflict (id) do update
  set name = excluded.name, lat = excluded.lat, lng = excluded.lng;

-- voice_label / gesture_label / gesture_hint must match firmware/kiosk_node/config.h
-- (a Vitest test checks this against apps/web/lib/destinations.ts).
insert into public.destinations (code, name, route, sort_order, voice_label, gesture_label, gesture_hint) values
  ('NYA', 'Nyabugogo', 'R1', 1, 'nyabugogo', 'three_taps', 'Tap 3 times'),
  ('REM', 'Remera',    'R2', 2, 'remera',    'one_tap',    'Tap once'),
  ('KIM', 'Kimironko', 'R3', 3, 'kimironko', 'hold',       'Hold your hand still'),
  ('DTN', 'Downtown',  'R4', 4, 'downtown',  'two_taps',   'Tap twice')
on conflict (code) do update
  set name = excluded.name, route = excluded.route, sort_order = excluded.sort_order,
      voice_label = excluded.voice_label, gesture_label = excluded.gesture_label,
      gesture_hint = excluded.gesture_hint;

insert into public.buses (id, destination) values
  ('R1-01', 'NYA'), ('R1-02', 'NYA'),
  ('R2-01', 'REM'), ('R2-02', 'REM'),
  ('R3-01', 'KIM'), ('R3-02', 'KIM'),
  ('R4-01', 'DTN'), ('R4-02', 'DTN')
on conflict (id) do nothing;

-- Tuned values are kept if the seed runs again.
insert into public.config (key, value, description) values
  ('release_load_pct',    70, 'Recommend a release when waiting passengers reach this % of bus capacity'),
  ('max_wait_minutes',    15, 'Recommend a release when the oldest passenger has waited this long'),
  ('default_eta_minutes',  8, 'ETA shown when a bus is released, before GPS updates arrive'),
  ('avg_bus_speed_kmh',   18, 'Average bus speed used to turn GPS distance into an ETA'),
  ('arrival_radius_m',    50, 'A bus within this distance of the stop is marked arrived')
on conflict (key) do nothing;
