"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

/** The signed-in account, kept in sync with Supabase Auth (sign in, sign out, other tabs). */
export function useAccountState(): AccountState {
  const [state, setState] = useState<AccountState>(
    SUPABASE_CONFIG_ERROR ? { status: "error", message: SUPABASE_CONFIG_ERROR } : { status: "loading" },
  );

  useEffect(() => {
    if (SUPABASE_CONFIG_ERROR) return;
    const auth = getSupabase().auth;
    let live = true;
    let latest = 0;
    const apply = (session: Session | null) => {
      const ticket = ++latest;
      if (!session) {
        setState({ status: "signed_out" });
        return;
      }
      void loadAccount(session).then((next) => {
        if (live && ticket === latest) setState(next);
      });
    };
    // Fires INITIAL_SESSION straight away, then on every change. Supabase calls must not be
    // awaited inside this callback, so the profile load runs after it returns.
    const { data } = auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      setTimeout(() => {
        if (live) apply(session);
      }, 0);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
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
