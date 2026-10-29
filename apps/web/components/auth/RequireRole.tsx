"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { HomeLink } from "@/components/HomeLink";
import { canOpen, PAGE_ROLES, ROLE_LABEL, type ProtectedPage } from "@/lib/auth";
import { AccountProvider, signOut, useAccountState } from "@/lib/use-account";

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <HomeLink />
      <h1 className="text-[32px] leading-tight">{title}</h1>
      {children}
    </main>
  );
}

/** Opens the page only for its roles; otherwise sends the visitor to /login or explains why not. */
export function RequireRole({ page, children }: { page: ProtectedPage; children: ReactNode }) {
  const state = useAccountState();
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (state.status === "signed_out") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [state.status, router, pathname]);

  const switchAccount = async () => {
    setSigningOut(true);
    await signOut();
  };

  switch (state.status) {
    case "loading":
    case "signed_out":
      return (
        <p className="p-8 text-muted" aria-live="polite">
          Checking your sign-in…
        </p>
      );
    case "error":
      return (
        <Notice title="Can't reach Tap&Select">
          <Banner tone="danger" title="Setup problem">
            {state.message}
          </Banner>
        </Notice>
      );
    case "no_profile":
      return (
        <Notice title="Your account isn't set up yet">
          <p className="text-muted">
            Signed in as <span className="font-semibold text-ink">{state.email}</span>. {state.message} Ask an admin
            to give you a role.
          </p>
          <Button variant="ink" size="lg" onClick={switchAccount} pending={signingOut}>
            Sign out
          </Button>
        </Notice>
      );
    case "signed_in": {
      const { account } = state;
      if (canOpen(account.role, page)) return <AccountProvider account={account}>{children}</AccountProvider>;
      const allowed = PAGE_ROLES[page].map((r) => ROLE_LABEL[r].toLowerCase()).join(", ");
      return (
        <Notice title="This screen isn't for your account">
          <p className="text-muted">
            You&rsquo;re signed in as <span className="font-semibold text-ink">{account.email}</span> (
            {ROLE_LABEL[account.role]}). <span className="num">{page}</span> is for: {allowed}.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="ink" size="lg" onClick={switchAccount} pending={signingOut}>
              Sign in as someone else
            </Button>
            <Link
              href="/"
              className="inline-flex h-14 items-center rounded-card border border-line bg-surface px-6 font-semibold hover:border-ink"
            >
              Home
            </Link>
          </div>
        </Notice>
      );
    }
  }
}
