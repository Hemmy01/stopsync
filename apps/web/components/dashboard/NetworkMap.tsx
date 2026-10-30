"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Bus } from "@/lib/departures";
import { DESTINATIONS, getDestination } from "@/lib/destinations";
import type { Route } from "@/lib/routes";

type Leaflet = typeof import("leaflet");

interface NetworkMapProps {
  routes: readonly Route[];
  buses: readonly Bus[];
  selectedBusId: string | null;
  onSelectBus: (busId: string) => void;
}

const KIOSK_STOP_ID = "STOP-01";

/** CSS colours in SVG attributes can't use var(); read the token's value instead. */
function cssColor(value: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(value);
  if (!m) return value;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || "#111418";
}

function routeColor(route: string): string {
  return DESTINATIONS.find((d) => d.route === route)?.color ?? "var(--ink)";
}

function busIcon(L: Leaflet, bus: Bus, selected: boolean) {
  const el = document.createElement("span");
  el.className = selected ? "bus-marker bus-marker-selected" : "bus-marker";
  el.style.backgroundColor = getDestination(bus.destination)?.color ?? "var(--ink)";
  el.textContent = bus.id;
  return L.divIcon({ html: el, className: "bus-marker-wrap", iconSize: [64, 28], iconAnchor: [32, 14] });
}

/**
 * All routes, stops and live buses on an OpenStreetMap base (greyed so route colours
 * carry the meaning). Leaflet touches `window`, so it's loaded in the browser only.
 */
export function NetworkMap({ routes, buses, selectedBusId, onSelectBus }: NetworkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const routeLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, import("leaflet").Marker>());
  const onSelectRef = useRef(onSelectBus);
  const [L, setL] = useState<Leaflet | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelectBus;
  }, [onSelectBus]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    const markers = markersRef.current;
    void import("leaflet").then((leaflet) => {
      if (cancelled || !containerRef.current) return;
      const map = leaflet.map(containerRef.current, { scrollWheelZoom: false }).setView([-1.9441, 30.0619], 13);
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          className: "map-tiles-muted",
        })
        .addTo(map);
      mapRef.current = map;
      routeLayerRef.current = leaflet.layerGroup().addTo(map);
      setL(leaflet);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, []);

  // Route lines and stops (they only change with a migration).
  useEffect(() => {
    const map = mapRef.current;
    const layer = routeLayerRef.current;
    if (!L || !map || !layer || routes.length === 0) return;
    layer.clearLayers();
    const all: [number, number][] = [];
    for (const route of routes) {
      const color = cssColor(routeColor(route.route));
      const line = route.stops.map((s) => [s.lat, s.lng] as [number, number]);
      all.push(...line);
      L.polyline(line, { color, weight: 5, opacity: 0.85, interactive: false }).addTo(layer);
      for (const stop of route.stops) {
        if (stop.id === KIOSK_STOP_ID) continue;
        L.circleMarker([stop.lat, stop.lng], { radius: 5, color, weight: 3, fillColor: "#ffffff", fillOpacity: 1 })
          .bindTooltip(`${stop.name} · ${route.route}`, { direction: "top" })
          .addTo(layer);
      }
    }
    const kiosk = routes[0].stops.find((s) => s.id === KIOSK_STOP_ID);
    if (kiosk) {
      L.circleMarker([kiosk.lat, kiosk.lng], {
        radius: 9,
        color: cssColor("var(--ink)"),
        weight: 4,
        fillColor: "#ffffff",
        fillOpacity: 1,
      })
        .bindTooltip("Kiosk 1", { direction: "top", permanent: true, className: "map-kiosk-label" })
        .addTo(layer);
    }
    if (all.length > 0) map.fitBounds(L.latLngBounds(all), { padding: [24, 24] });
  }, [L, routes]);

  // Bus markers: add, move, restyle, remove.
  useEffect(() => {
    const map = mapRef.current;
    if (!L || !map) return;
    const markers = markersRef.current;
    const live = new Set<string>();
    for (const bus of buses) {
      if (bus.lat === null || bus.lng === null) continue;
      live.add(bus.id);
      const icon = busIcon(L, bus, bus.id === selectedBusId);
      const existing = markers.get(bus.id);
      if (existing) {
        existing.setLatLng([bus.lat, bus.lng]).setIcon(icon);
      } else {
        const marker = L.marker([bus.lat, bus.lng], { icon, title: `Bus ${bus.id}`, riseOnHover: true })
          .on("click", () => onSelectRef.current(bus.id))
          .addTo(map);
        markers.set(bus.id, marker);
      }
      markers.get(bus.id)?.setZIndexOffset(bus.id === selectedBusId ? 1000 : 0);
    }
    for (const [id, marker] of markers) {
      if (!live.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
  }, [L, buses, selectedBusId]);

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full overflow-hidden rounded-card border border-line bg-paper"
      role="region"
      aria-label="Map of routes, stops and buses"
    />
  );
}
