# Feature tour: try everything Tap&Select does

A hands-on checklist. Allow about 30 minutes. You need a **laptop** (Chrome) and a **phone**.
Live site: **https://tap-and-select.vercel.app**. Locally it is `http://localhost:3000`.

**Moving around.** Click the **Tap&Select** logo to go home. The **person icon** in the top right
of every screen lists every screen your account can open, and **Sign out or switch account**. After
switching, you come back to the same screen if the new role can open it. On `/login`, the
**Demo login as…** buttons sign in with one click (Admin, Dispatcher, Driver, Kiosk, Viewer).

Start clean: sign in as **Admin**, open **Dashboard**, press **Reset demo** and confirm.

## 1. Accounts and roles (2 min)

- [ ] Signed out, open `/dashboard`: you are sent to the login page.
- [ ] **Demo login → Viewer**: the dashboard opens read-only (no Approve, no Settings edits).
- [ ] Person icon → the menu lists only Dashboard and About. On the home page, Kiosk and Bus show a lock.
- [ ] Person icon → **Sign out or switch account** → **Admin**: same dashboard, now with every button and a **Users** link.
- [ ] **Users** (admin only): change someone's role and see it take effect.

## 2. Passenger kiosk (laptop, 5 min)

Admin or Kiosk → menu → **Kiosk**. Press **D** to open the debug drawer (mock board).

- [ ] **Hold your card here** → pick **Test card** (a new passenger each time).
- [ ] Listening: in the drawer, send `SELECT` for a stop (voice or gesture), or tap a tile.
- [ ] Confirm shows how it was chosen ("Heard by voice · 91%"). Press **Change** once, then **Confirm**.
- [ ] Ticket: big number, place in the queue, live status. With sound on you hear "Your number is…".
- [ ] Tap the **same demo card** again: "You're already in the queue" → **Cancel my place** → pick a reason → confirm.
- [ ] Switch to **Kinyarwanda** in the top bar and repeat a ticket (the text is a draft that still needs review).
- [ ] With a real board: **Connect board**, then say a stop name or swipe over the sensor.

## 3. HQ dashboard (laptop, 5 min)

Admin or Dispatcher → **Dashboard**. Keep the kiosk open in a second window.

- [ ] Waiting counts, oldest wait and the load bar update as you make tickets.
- [ ] **Recompute now**: each route gets a recommendation with a reason. **Approve** one.
- [ ] The kiosk's ticket and departure strip change to "Bus R2-01 · about N min" on their own.
- [ ] **Simulate drive** under the released bus: it moves on the live map; the kiosk shows the route strip, then "Now boarding" with a spoken call.
- [ ] **Reset bus** when it has arrived. Also try **Bus arrived** on another released bus.
- [ ] Panels lower down: how passengers chose (voice/gesture/tap), model insights, cancellation reasons, activity feed, Settings (edit `release_load_pct` and watch the recommendation change).

## 4. Bus driver on your phone (5 min)

On the laptop, as Admin or Dispatcher, approve a recommendation first and note which bus was released
(e.g. R2-01). On the phone open **https://tap-and-select.vercel.app/login** → **Demo login → Driver**.

- [ ] The driver starts on R2-01. Tap **Change bus**, pick the released bus (taken buses are greyed
      out), or **Keep** to go back.

- [ ] **Start tracking** and allow location. "Last sent" and "Accuracy" fill in.
- [ ] On the laptop, the bus appears on the dashboard's live map with an ETA. The kiosk ticket ETA follows.
- [ ] Walk around: the ETA updates. Within 50 m of the kiosk point it arrives by itself (indoors, use **I've arrived**).
- [ ] If location was refused: the page explains how to allow it (it needs https, which the live site has).

## 5. Live board for the audience (1 min)

- [ ] On any phone, **without signing in**, scan the QR on pitch slide 9 (or open `/live`): departures, queue counts, Now boarding and the map, refreshing every few seconds.

## 6. Pitch and About (2 min)

- [ ] `/about`: problem, how it works, real vs simulated, models.
- [ ] `/pitch`: the slides (arrow keys).

## When you are done

Admin → Dashboard → **Reset demo**, so the next run starts clean.
