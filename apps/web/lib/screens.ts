// The app's screens, for the home page and the account menu. Pure.

import { canOpen, type ProtectedPage, type Role } from "./auth";

export interface Screen {
  href: "/kiosk" | "/dashboard" | "/bus" | "/live" | "/admin/users" | "/about";
  label: string;
  detail: string;
  /** Opens for anyone, signed in or not. */
  public?: boolean;
  /** Listed in the account menu only, not on the home page. */
  menuOnly?: boolean;
}

export const SCREENS: readonly Screen[] = [
  { href: "/kiosk", label: "Kiosk", detail: "Passenger screen at the stop" },
  { href: "/dashboard", label: "Dashboard", detail: "HQ demand and dispatch" },
  { href: "/bus", label: "Bus", detail: "Driver phone, shares GPS" },
  { href: "/live", label: "Live board", detail: "Follow along on your phone, no sign-in", public: true },
  { href: "/admin/users", label: "Users", detail: "Accounts and roles", menuOnly: true },
  { href: "/about", label: "About", detail: "How it works", public: true, menuOnly: true },
];

/** Whether this role (or a signed-out visitor, null) may open the screen. */
export function screenOpensFor(screen: Screen, role: Role | null): boolean {
  if (screen.public) return true;
  return role !== null && canOpen(role, screen.href as ProtectedPage);
}
