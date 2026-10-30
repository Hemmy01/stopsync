"use client";

import { useAccount } from "@/lib/use-account";
import { AccountMenu } from "./AccountMenu";

/** The account menu for screens inside RequireRole. `compact` shows only the icon (phones). */
export function AccountBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  return <AccountMenu account={useAccount()} className={className} compact={compact} />;
}
