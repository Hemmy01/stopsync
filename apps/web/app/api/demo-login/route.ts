import { createClient } from "@supabase/supabase-js";
import { demoEmail, isRole } from "@/lib/auth";

// "Demo login as…": signs in to a seeded demo account on the server, so DEMO_PASSWORD
// (server-only, no NEXT_PUBLIC_ prefix) never reaches the browser. Off unless demo mode is on.
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return Response.json({ error: "Demo mode is off." }, { status: 404 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const password = process.env.DEMO_PASSWORD;
  if (!url || !anonKey || !password) {
    return Response.json({ error: "Demo login isn't configured: set DEMO_PASSWORD on the server." }, { status: 500 });
  }

  const body: unknown = await request.json().catch(() => null);
  const role = (body as { role?: unknown } | null)?.role;
  if (!isRole(role)) return Response.json({ error: "Unknown role." }, { status: 400 });

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email: demoEmail(role), password });
  if (error || !data.session) {
    return Response.json(
      { error: `The demo ${role} account (${demoEmail(role)}) isn't set up, or its password differs from DEMO_PASSWORD.` },
      { status: 401 },
    );
  }
  return Response.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
}
