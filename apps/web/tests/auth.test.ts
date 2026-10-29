import { describe, expect, it } from "vitest";
import { canAdminister, canDispatch, canOpen, demoEmail, HOME_FOR, isRole, PAGE_ROLES, ROLES, safeNext } from "@/lib/auth";

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
