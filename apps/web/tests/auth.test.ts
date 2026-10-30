import { describe, expect, it } from "vitest";
import {
  afterSignIn,
  canAdminister,
  canDispatch,
  canOpen,
  demoEmail,
  demoRoles,
  HOME_FOR,
  isRole,
  PAGE_ROLES,
  ROLES,
  safeNext,
  signInErrorMessage,
} from "@/lib/auth";

describe("canOpen", () => {
  it("matches the brief: kiosk, dashboard (incl. viewer), bus for drivers, users for admins", () => {
    expect(canOpen("kiosk", "/kiosk")).toBe(true);
    expect(canOpen("viewer", "/kiosk")).toBe(false);
    expect(canOpen("viewer", "/dashboard")).toBe(true);
    expect(canOpen("dispatcher", "/dashboard")).toBe(true);
    expect(canOpen("driver", "/dashboard")).toBe(false);
    expect(canOpen("driver", "/bus")).toBe(true);
    expect(canOpen("dispatcher", "/bus")).toBe(false);
    expect(canOpen("dispatcher", "/admin/users")).toBe(false);
  });

  it("lets admin open every screen", () => {
    for (const page of Object.keys(PAGE_ROLES) as (keyof typeof PAGE_ROLES)[]) {
      expect(canOpen("admin", page)).toBe(true);
    }
  });

  it("sends every role to a page it can open", () => {
    for (const role of ROLES) expect(canOpen(role, HOME_FOR[role])).toBe(true);
  });
});

describe("dashboard permissions", () => {
  it("only dispatchers and admins act; only admins change settings", () => {
    expect(ROLES.filter(canDispatch)).toEqual(["admin", "dispatcher"]);
    expect(ROLES.filter(canAdminister)).toEqual(["admin"]);
  });
});

describe("safeNext", () => {
  it("keeps same-site paths and drops anything that could leave the site", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/bus?x=1")).toBe("/bus?x=1");
    expect(safeNext(null)).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
  });
});

describe("roles", () => {
  it("recognises only the five roles and names demo accounts after them", () => {
    expect(isRole("driver")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    expect(demoEmail("kiosk")).toBe("kiosk@tapselect.demo");
  });
});

describe("demoRoles", () => {
  it("leaves admin out unless it is listed", () => {
    expect(demoRoles(undefined)).toEqual(["kiosk", "dispatcher", "driver", "viewer"]);
    expect(demoRoles("")).not.toContain("admin");
    expect(demoRoles("admin, Kiosk ,nonsense")).toEqual(["admin", "kiosk"]);
  });
});

describe("signInErrorMessage", () => {
  it("explains Supabase's sign-in limit and passes other messages through", () => {
    expect(signInErrorMessage("Request rate limit reached")).toMatch(/Too many sign-ins/);
    expect(signInErrorMessage("whatever", 429)).toMatch(/Live board/);
    expect(signInErrorMessage("Invalid login credentials")).toBe("Invalid login credentials");
  });
});

describe("afterSignIn", () => {
  it("returns to the page the visitor came from when their role may open it", () => {
    expect(afterSignIn("dispatcher", "/dashboard")).toBe("/dashboard");
    expect(afterSignIn("viewer", "/live")).toBe("/live");
    expect(afterSignIn("admin", "/kiosk?mock=1")).toBe("/kiosk?mock=1");
  });

  it("goes to the role's home instead of a page it can't open", () => {
    expect(afterSignIn("driver", "/kiosk")).toBe("/bus");
    expect(afterSignIn("kiosk", "/admin/users")).toBe("/kiosk");
    expect(afterSignIn("dispatcher", null)).toBe("/dashboard");
  });
});
