# Rehearsal checklist

## The day before

- [ ] All PRs merged; Vercel Production deployment is green and opens `/`, `/kiosk`, `/dashboard`, `/bus`, `/about`.
- [ ] Vercel env vars set (3 × `NEXT_PUBLIC_*`); no "Supabase is not configured" banner.
- [ ] Supabase project active (free projects pause after a week idle: open the Supabase dashboard).
- [ ] `cd apps/web && npm run check` passes; `firmware/scripts/compile-all.sh` passes.
- [ ] Board flashed with the demo build; boot `LOG` shows the intended `voice=` / `gesture=` modes.
- [ ] Each stop 10 times on the board (`firmware/README.md` step 6); results in `ml/results/`.
- [ ] `apps/web/content/models.json` updated (status, test accuracy, date) and deployed; `/about` shows it.
- [ ] Two builds ready if using option 3 (`build/voice`, `build/gesture`) and the upload command tested.
- [ ] `/about` printed (Chrome → Print → Background graphics on).
- [ ] Full run of `docs/demo-script.md`, including every fallback once.

## One hour before

- [ ] Laptop A: charger in, sleep disabled, notifications off, Chrome zoom 100%, full screen (`⌃⌘F`).
- [ ] Board on USB (data cable, not charge-only); kiosk **Connect board** → pill *Connected*.
- [ ] No Serial Monitor / `arduino-cli monitor` open (they lock the port).
- [ ] Tap test over the sensor in the real room lighting; adjust `PROX_*` if the room is very bright.
- [ ] Voice test at demo volume; check the room noise doesn't select anything over 20 s of listening.
- [ ] Laptop B: `/dashboard` open; **Reset demo** done; **Release after waiting** = `1`.
- [ ] Phone: charged, location on, `/bus` opened on the `https://` URL, permission granted, bus list loads.
- [ ] Wi-Fi works for all three devices; hotspot from the phone ready as backup.
- [ ] Mock drawer works (`D` on the kiosk): the fallback if the board fails.

## Pass/fail record

| Check | Pass | Notes |
|---|---|---|
| Kiosk mock journey (card → select → confirm → ticket) | | |
| Duplicate card → "already queued" | | |
| Approve on dashboard → kiosk ticket + strip update | | |
| Phone GPS → ETA updates on kiosk + dashboard | | |
| Arrival (GPS radius or button) → boarded | | |
| Board: tap once / twice / 3 times / hold → REM / DTN / NYA / KIM | | |
| Board: Change → listens again | | |
| Board: LEDs (blue breathing, route colour, green pulse) | | |
| Voice (if model loaded): each stop | | |
| Reset demo | | |
