-- Gestures are now swipes read by the APDS9960 direction engine (firmware GESTURE_SWIPE).
-- Data only: the columns stay the same. Must match firmware/kiosk_node/config.h and
-- apps/web/lib/destinations.ts. The tap patterns (older GESTURE_RULE build and the planned
-- tap model) live only in those two files.
update public.destinations d
   set gesture_label = m.gesture_label, gesture_hint = m.gesture_hint
  from (values
    ('REM', 'swipe_left',  'Swipe left'),
    ('DTN', 'swipe_right', 'Swipe right'),
    ('NYA', 'swipe_up',    'Swipe up'),
    ('KIM', 'swipe_down',  'Swipe down')
  ) as m(code, gesture_label, gesture_hint)
 where d.code = m.code;
