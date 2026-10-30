"use client";

import Link from "next/link";
import { useAccountState } from "@/lib/use-account";
import { AccountMenu } from "./AccountMenu";

/** Home page corner: the account menu when signed in, otherwise a Sign in link. */
export function HomeAccount() {
  const state = useAccountState();
  if (state.status === "signed_in") {
    // Icon only on phones, so the clock keeps its room.
    return (
      <>
        <AccountMenu account={state.account} compact className="sm:hidden" />
        <AccountMenu account={state.account} className="hidden sm:block" />
      </>
    );
  }
  return (
    <Link href="/login" className="inline-flex h-11 items-center font-semibold underline underline-offset-4">
      Sign in
    </Link>
  );
}
