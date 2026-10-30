import { describe, expect, it } from "vitest";
import { parseLiveBoard } from "@/lib/live-board";

describe("parseLiveBoard", () => {
  it("reads buses, the kiosk queue, waiting counts and routes", () => {
    const board = parseLiveBoard({
      stop: { id: "STOP-01", name: "Kiosk 1 (Demo)" },
      buses: [
        { id: "R2-01", destination: "REM", status: "on_the_way", lat: -1.95, lng: 30.07, eta_minutes: 6, seats: 40, standing: 30, occupancy: 3 },
      ],
      tokens: [{ id: 7, code: "R2-004", destination: "REM", status: "waiting", bus_id: null, created_at: "2026-10-30T08:00:00Z" }],
      network_waiting: { REM: 3, NYA: 0 },
      routes: [
        {
          route: "R2",
          terminal_radius_m: 120,
          stops: [
            { id: "STOP-03", name: "Giporoso", lat: -1.95, lng: 30.1, distance_m: 0 },
            { id: "STOP-01", name: "Kiosk 1", lat: -1.94, lng: 30.06, distance_m: 4200 },
          ],
        },
      ],
      updated_at: "2026-10-30T08:00:05Z",
    });
    expect(board.stop).toEqual({ id: "STOP-01", name: "Kiosk 1 (Demo)" });
    expect(board.buses[0]).toMatchObject({ id: "R2-01", status: "on_the_way", eta_minutes: 6, occupancy: 3, released_at: null });
    expect(board.tokens).toEqual([
      { id: 7, code: "R2-004", destination: "REM", status: "waiting", bus_id: null, created_at: "2026-10-30T08:00:00Z" },
    ]);
    expect(board.networkWaiting).toEqual({ REM: 3, NYA: 0 });
    expect(board.routes[0]).toEqual({
      route: "R2",
      terminalRadiusM: 120,
      stops: [
        { id: "STOP-03", name: "Giporoso", lat: -1.95, lng: 30.1, distanceM: 0 },
        { id: "STOP-01", name: "Kiosk 1", lat: -1.94, lng: 30.06, distanceM: 4200 },
      ],
    });
  });

  it("drops malformed rows instead of crashing", () => {
    const board = parseLiveBoard({
      buses: [{ id: "R1-01" }, "nonsense", null],
      tokens: [{ code: "R1-001" }],
      routes: [{ stops: [] }],
      network_waiting: { REM: "many" },
    });
    expect(board).toEqual({ stop: null, buses: [], tokens: [], networkWaiting: {}, routes: [], updatedAt: null });
    expect(parseLiveBoard(null).buses).toEqual([]);
  });
});
