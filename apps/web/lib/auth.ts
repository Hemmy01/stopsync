// Roles and what each one may open or do. Pure: the database enforces the same rules
// (supabase/migrations/20261030090000_user_roles.sql); this only shapes the screens.

export const ROLES = ["admin", "dispatcher", "driver", "kiosk", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  dispatcher: "Dispatcher",
  driver: "Driver",
  kiosk: "Kiosk",
  viewer: "Viewer",
};

export interface Account {
  userId: string;
  email: string;
  name: string;
  role: Role;
  /** A driver's bus; null for every other role. */
  busId: string | null;
}

/** Who may open each protected screen. */
export const PAGE_ROLES = {
  "/kiosk": ["kiosk", "admin"],
  "/dashboard": ["dispatcher", "admin", "viewer"],
  "/bus": ["driver", "admin"],
  "/admin/users": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type ProtectedPage = keyof typeof PAGE_ROLES;

export function canOpen(role: Role, page: ProtectedPage): boolean {
  return (PAGE_ROLES[page] as readonly Role[]).includes(role);
}

/** Dashboard actions: approve/dismiss, arrive, reset bus, recompute. */
export const canDispatch = (role: Role) => role === "dispatcher" || role === "admin";
/** Settings and Reset demo. */
export const canAdminister = (role: Role) => role === "admin";

/** Where a role lands after signing in when no page was asked for. */
export const HOME_FOR: Record<Role, ProtectedPage> = {
  admin: "/dashboard",
  dispatcher: "/dashboard",
  viewer: "/dashboard",
  driver: "/bus",
  kiosk: "/kiosk",
};

/** Only same-site paths (no "//evil.com", no full URLs) may be used to return after login. */
export function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

export const DEMO_ROLES: readonly Role[] = ROLES;
export const demoEmail = (role: Role) => `${role}@tapselect.demo`;
