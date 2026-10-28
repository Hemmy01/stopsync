# Live demo script (about 6 minutes)

**Setup**
- Laptop A: Chrome on `https://<vercel-url>/kiosk`, board on USB, connected.
- Laptop B (or tablet): `/dashboard`.
- Phone: `/bus`, location permission granted.
- `/about` printed for the judges.

**Before you start:** dashboard → **Reset demo**. Settings → **Release after waiting** = `1` min, so a
release appears during the demo.

| # | Say / do | What they should see | If it doesn't work |
|---|---|---|---|
| 1 | "Passengers wait without knowing if a bus is coming. Tap&Select is a digital waiting list." Show the kiosk idle screen and the *How to choose your stop* sign. | Kiosk idle, board status pill **Connected**, LED off. | Pill says *Not connected*: click **Connect board**. Still nothing: press **D** for the mock drawer and continue; say "the board's messages go through exactly this path". |
| 2 | Tap the card reader → **Demo card 1**. | *Say your stop or show a gesture*, tiles with hints, LED **blue breathing**. | LED stays off: replug USB, **Connect board**, repeat. Fallback: drawer `STATE,LISTENING`. |
| 3 | **Tap twice** over the sensor (about 2 cm, quick). | *Downtown?* with **Gesture · 100%**, LED **purple**. | Not recognised within ~5 s: tap twice again, slower and closer. Fallback: tap the **Downtown** tile ("the on-screen fallback for when the model doesn't catch it"). |
| 4 | Press **Change**, then say **"Kimironko"** (voice build) or **hold** your hand still. | Back to listening (board got `START` again), then *Kimironko?*, LED **yellow**. | Voice model not loaded: use hold. Hold not recognised: keep the hand still ~2 s, a few cm above. Fallback: drawer `SELECT,KIM,voice`. |
| 5 | **Confirm.** | Boarding-pass ticket `R3-00x`, position, *Waiting for dispatch*; LED **green pulse**. Strip count goes up. | Error banner on confirm: check Wi-Fi; press Confirm again (it never double-books). |
| 6 | Tap **Demo card 1** again. | *You're already in the queue* with the same code. | n/a (pure database rule). |
| 7 | Add 2–3 more tickets with cards 2–4 (any input). | Dashboard waiting counts and the activity feed update live. | Dashboard stale: reload it; Realtime reconnects. |
| 8 | Dashboard: walk through waiting, oldest wait, load bar, **How passengers chose**, **Model insights**. | Voice/gesture share, confirmation rate, average confidence. | Insights empty: they fill from today's selections; point at the counts in the feed instead. |
| 9 | Within a minute a **Release a bus** recommendation appears for Kimironko. **Approve**. | Kiosk ticket/strip: *R3-01 · 8 min*. | No recommendation yet: press **Recompute now**. "No free bus": press **Reset bus** on the arrived one. |
| 10 | Phone: `/bus` → **R3-01** → **Start sharing location**. Walk away and back. | ETA changes on kiosk and dashboard; last-sent time ticks every 5 s. | GPS denied/unavailable: say "the driver's app" and press **I've arrived** instead. |
| 11 | Near the kiosk (≤ 50 m) or press **I've arrived**. | Kiosk *Your bus is here* / strip *Boarding*; dashboard boarded count. | Phone not helping: dashboard **Bus arrived**. |
| 12 | Optional: `node simulator/simulate.mjs --profile peak --speed 10` on laptop B. | City-wide demand climbs on the dashboard; kiosk strip stays per-stop. | Skip it. |
| 13 | Close on `/about`: Sense → Decide → Inform, real vs simulated, next upgrades. | | Use the printout. |

**After the demo:** Settings → **Release after waiting** back to `15`; **Reset demo**; stop the simulator (Ctrl+C).

## Two-minute version

Steps 2, 3, 5, 9, 11.
