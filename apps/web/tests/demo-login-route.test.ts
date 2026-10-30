import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/demo-login/route";

const post = (role: string) =>
  POST(new Request("http://localhost/api/demo-login", { method: "POST", body: JSON.stringify({ role }) }));

describe("/api/demo-login", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("DEMO_PASSWORD", "not-used-in-these-tests");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_DEMO_ROLES", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    expect((await post("kiosk")).status).toBe(404);
  });

  it("refuses admin unless NEXT_PUBLIC_DEMO_ROLES lists it", async () => {
    const res = await post("admin");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toMatch(/turned off/);
  });

  it("refuses unknown roles", async () => {
    expect((await post("superuser")).status).toBe(400);
  });
});
