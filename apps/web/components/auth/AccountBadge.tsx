"use client";

import clsx from "clsx";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { ROLE_LABEL } from "@/lib/auth";
import { signOut, useAccount } from "@/lib/use-account";

/** "Name · Role" with a sign-out button, for screen headers. */
export function AccountBadge({ className }: { className?: string }) {
  const account = useAccount();
  const [pending, setPending] = useState(false);

  return (
    <div className={clsx("flex items-center gap-2 text-sm", className)}>
      <span className="min-w-0 text-right leading-tight">
        <span className="block max-w-[180px] truncate font-semibold">{account.name}</span>
        <span className="block text-muted">
          {ROLE_LABEL[account.role]}
          {account.busId ? ` · ${account.busId}` : ""}
        </span>
      </span>
      <button
        type="button"
        onClick={async () => {
          setPending(true);
          await signOut();
        }}
        disabled={pending}
        aria-label="Sign out"
        title="Sign out"
        className="inline-flex h-11 w-11 items-center justify-center rounded-card border border-line bg-surface text-muted transition-colors duration-200 ease-out hover:border-ink hover:text-ink disabled:opacity-50"
      >
        <LogOut aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
