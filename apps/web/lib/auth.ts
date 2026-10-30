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

/**
 * Where to go after signing in: the page the visitor came from if their role may open it,
 * otherwise their role's home (so a driver sent from /kiosk lands on /bus, not in a loop).
 */
export function afterSignIn(role: Role, next: string | null): string {
  if (!next) return HOME_FOR[role];
  const path = next.split(/[?#]/)[0];
  const page = (Object.keys(PAGE_ROLES) as ProtectedPage[]).find((p) => path === p || path.startsWith(`${p}/`));
  return !page || canOpen(role, page) ? next : HOME_FOR[role];
}

/** Demo logins offered when NEXT_PUBLIC_DEMO_ROLES isn't set: everyone but admin. */
export const DEFAULT_DEMO_ROLES: readonly Role[] = ["kiosk", "dispatcher", "driver", "viewer"];

/**
 * Which "Demo login as…" roles to offer, from a comma list like "kiosk,dispatcher,admin".
 * Admin is only offered when listed, so a deployed demo doesn't hand out admin by default.
 * Unknown names are ignored; the order follows ROLES.
 */
export function demoRoles(setting: string | undefined): Role[] {
  if (!setting || setting.trim() === "") return [...DEFAULT_DEMO_ROLES];
  const wanted = new Set(setting.split(",").map((r) => r.trim().toLowerCase()));
  return ROLES.filter((r) => wanted.has(r));
}

export const demoEmail = (role: Role) => `${role}@tapselect.demo`;

/** A friendlier message for Supabase Auth's per-network sign-in limit. */
export function signInErrorMessage(message: string, status?: number): string {
  if (status === 429 || /rate limit|too many/i.test(message)) {
    return "Too many sign-ins from this network in the last few minutes. Wait a minute and try again. (The Live board at /live needs no sign-in.)";
  }
  return message;
}
