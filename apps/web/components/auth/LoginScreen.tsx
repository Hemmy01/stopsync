"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { HomeLink } from "@/components/HomeLink";
import { afterSignIn, demoRoles, isRole, ROLE_LABEL, safeNext, signInErrorMessage, type Role } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { signOut, useAccountState } from "@/lib/use-account";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const DEMO_ROLES = demoRoles(process.env.NEXT_PUBLIC_DEMO_ROLES);

const DEMO_DETAIL: Record<Role, string> = {
  admin: "Everything, settings and users",
  dispatcher: "Dashboard: approve, arrive, reset",
  driver: "Bus R2-01 on /bus",
  kiosk: "The stop's passenger screen",
  viewer: "Dashboard, read-only",
};

const INPUT = "h-12 w-full rounded-card border border-line bg-surface px-4 text-base focus:border-ink";

function readNext(): string | null {
  try {
    return safeNext(new URLSearchParams(window.location.search).get("next"));
  } catch {
    return null;
  }
}

export function LoginScreen() {
  const router = useRouter();
  const state = useAccountState();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setNext(readNext());
    read();
  }, []);

  const go = (role: Role) => router.replace(afterSignIn(role, next));

  const roleOf = async (userId: string): Promise<Role> => {
    const { data } = await getSupabase().from("profiles").select("role").eq("id", userId).maybeSingle();
    return isRole(data?.role) ? data.role : "viewer";
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending("form");
    setError(null);
    setNotice(null);
    const auth = getSupabase().auth;
    try {
      if (mode === "sign_in") {
        const { data, error: err } = await auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        go(await roleOf(data.user.id));
      } else {
        const { data, error: err } = await auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (err) throw err;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("sign_in");
        } else {
          go("viewer");
        }
      }
    } catch (err) {
      const status = typeof err === "object" && err !== null && "status" in err ? Number(err.status) : undefined;
      setError(err instanceof Error ? signInErrorMessage(err.message, status) : "Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  };

  const demoLogin = async (role: Role) => {
    if (pending) return;
    setPending(role);
    setError(null);
    try {
      const res = await fetch("/api/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body: unknown = await res.json().catch(() => null);
      const tokens = body as { access_token?: unknown; refresh_token?: unknown; error?: unknown } | null;
      if (!res.ok || typeof tokens?.access_token !== "string" || typeof tokens.refresh_token !== "string") {
        throw new Error(typeof tokens?.error === "string" ? tokens.error : "Demo sign-in failed.");
      }
      const { error: err } = await getSupabase().auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (err) throw err;
      go(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sign-in failed.");
    } finally {
      setPending(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-8 sm:px-8">
      <header className="border-b border-line pb-6">
        <HomeLink />
      </header>

      <div className={clsx("grid flex-1 gap-10 py-10", DEMO_MODE && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
        <section className="max-w-md">
          <h1 className="text-[40px] leading-[1.05]">{mode === "sign_in" ? "Sign in" : "Create an account"}</h1>
          <p className="mt-2 text-muted">
            {mode === "sign_in"
              ? "Kiosks, drivers and HQ sign in to use Tap&Select."
              : "New accounts can view the dashboard. An admin gives you a role."}
          </p>

          {state.status === "signed_in" ? (
            <Banner tone="info" title={`Signed in as ${state.account.email}`} className="mt-6">
              {ROLE_LABEL[state.account.role]}.{" "}
              <button type="button" className="font-semibold underline underline-offset-4" onClick={() => go(state.account.role)}>
                Continue
              </button>{" "}
              or{" "}
              <button type="button" className="font-semibold underline underline-offset-4" onClick={() => void signOut()}>
                sign out
              </button>
              .
            </Banner>
          ) : null}

          {notice ? (
            <Banner tone="info" title="Almost there" className="mt-6">
              {notice}
            </Banner>
          ) : null}
          {error ? (
            <Banner tone="danger" title="Couldn't sign in" className="mt-6">
              {error}
            </Banner>
          ) : null}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "sign_up" ? (
              <label className="block">
                <span className="mb-1 block font-semibold">Name</span>
                <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1 block font-semibold">Email</span>
              <input
                className={INPUT}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-semibold">Password</span>
              <input
                className={INPUT}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                minLength={6}
                required
              />
            </label>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              pending={pending === "form"}
              disabled={pending !== null}
            >
              {mode === "sign_in" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted">
            {mode === "sign_in" ? "No account yet? " : "Already have an account? "}
            <button
              type="button"
              className="font-semibold text-ink underline underline-offset-4"
              onClick={() => {
                setMode(mode === "sign_in" ? "sign_up" : "sign_in");
                setError(null);
              }}
            >
              {mode === "sign_in" ? "Create one" : "Sign in"}
            </button>
          </p>
        </section>

        {DEMO_MODE ? (
          <section aria-labelledby="demo-title" className="rounded-card border border-line bg-surface p-6">
            <h2 id="demo-title" className="text-xl">
              Demo login as…
            </h2>
            <p className="mt-1 text-sm text-muted">One click per role. Shown only in demo mode.</p>
            <ul className="mt-4 grid gap-2">
              {DEMO_ROLES.map((role) => (
                <li key={role}>
                  <button
                    type="button"
                    onClick={() => void demoLogin(role)}
                    disabled={pending !== null}
                    aria-busy={pending === role}
                    className="flex min-h-14 w-full items-center justify-between gap-4 rounded-card border border-line px-4 py-2 text-left transition-colors duration-200 ease-out hover:border-ink disabled:opacity-60"
                  >
                    <span>
                      <span className="block font-semibold">{ROLE_LABEL[role]}</span>
                      <span className="block text-sm text-muted">{DEMO_DETAIL[role]}</span>
                    </span>
                    <span className="text-sm font-semibold text-muted">{pending === role ? "Signing in…" : "Sign in"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
