"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { isRole, type Account } from "./auth";
import { getSupabase, SUPABASE_CONFIG_ERROR } from "./supabase";

export type AccountState =
  | { status: "loading" }
  | { status: "signed_out" }
  /** Signed in, but no profile row could be read (or an unknown role). */
  | { status: "no_profile"; email: string; message: string }
  | { status: "signed_in"; account: Account }
  | { status: "error"; message: string };

async function loadAccount(session: Session): Promise<AccountState> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, email, name, role, bus_id")
    .eq("id", session.user.id)
    .maybeSingle();
  const email = session.user.email ?? "";
  if (error) return { status: "no_profile", email, message: error.message };
  if (!data || !isRole(data.role)) return { status: "no_profile", email, message: "This account has no role yet." };
  return {
    status: "signed_in",
    account: {
      userId: data.id,
      email: data.email ?? email,
      name: data.name ?? email,
      role: data.role,
      busId: data.role === "driver" ? data.bus_id : null,
    },
  };
}

// One shared, always-current account state for the whole app. A per-component copy went stale:
// Next keeps visited pages alive in the background, so a guard that saw "signed out" before
// the sign-in would bounce the visitor back to /login when they returned to that page.
const LOADING: AccountState = { status: "loading" };
let current: AccountState = SUPABASE_CONFIG_ERROR ? { status: "error", message: SUPABASE_CONFIG_ERROR } : LOADING;
const listeners = new Set<() => void>();
let started = false;
let latest = 0;

function publish(next: AccountState) {
  current = next;
  for (const notify of listeners) notify();
}

function apply(session: Session | null) {
  const ticket = ++latest;
  if (!session) {
    publish({ status: "signed_out" });
    return;
  }
  void loadAccount(session).then((next) => {
    if (ticket === latest) publish(next);
  });
}

/** Reload the profile, e.g. after a driver picks another bus. */
export async function refreshAccount() {
  const { data } = await getSupabase().auth.getSession();
  apply(data.session);
}

function start() {
  if (started || SUPABASE_CONFIG_ERROR) return;
  started = true;
  // Fires INITIAL_SESSION straight away, then on every change, for the life of the tab.
  getSupabase().auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") return;
    // A new or different user: "loading" at once, so no guard acts on the old state while the
    // profile loads.
    if (session && !(current.status === "signed_in" && current.account.userId === session.user.id)) {
      if (current.status !== "loading") publish(LOADING);
    }
    // Supabase calls must not be awaited inside this callback, so the profile load runs after it.
    setTimeout(() => apply(session), 0);
  });
}

function subscribe(notify: () => void) {
  start();
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** The signed-in account, kept in sync with Supabase Auth (sign in, sign out, other tabs). */
export function useAccountState(): AccountState {
  return useSyncExternalStore(subscribe, () => current, () => LOADING);
}

const AccountContext = createContext<Account | null>(null);

export function AccountProvider({ account, children }: { account: Account; children: ReactNode }) {
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}

/** The signed-in account inside a RequireRole gate. */
export function useAccount(): Account {
  const account = useContext(AccountContext);
  if (!account) throw new Error("useAccount must be used inside <RequireRole>");
  return account;
}

export async function signOut() {
  await getSupabase().auth.signOut();
}
