-- Extra stops for the network simulator (simulator/). Approximate Kigali coordinates.
-- STOP-01 (the real kiosk) stays in seed.sql.
insert into public.stops (id, name, lat, lng) values
  ('STOP-02', 'Nyabugogo Bus Park', -1.9397, 30.0445),
  ('STOP-03', 'Giporoso (Remera)',  -1.9601, 30.1066),
  ('STOP-04', 'Kimironko Market',   -1.9492, 30.1263),
  ('STOP-05', 'Kigali Heights',     -1.9534, 30.0925),
  ('STOP-06', 'Nyamirambo',         -1.9796, 30.0446)
on conflict (id) do update
  set name = excluded.name, lat = excluded.lat, lng = excluded.lng;
