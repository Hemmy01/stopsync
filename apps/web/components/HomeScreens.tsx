"use client";

import clsx from "clsx";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { ROLE_LABEL, PAGE_ROLES, type ProtectedPage } from "@/lib/auth";
import { SCREENS, screenOpensFor } from "@/lib/screens";
import { useAccountState } from "@/lib/use-account";

/** The home page's screen list; when signed in, screens this role can't open say who they're for. */
export function HomeScreens() {
  const state = useAccountState();
  const role = state.status === "signed_in" ? state.account.role : null;
  const screens = SCREENS.filter((s) => !s.menuOnly);

  return (
    <ul>
      {screens.map((screen, i) => {
        const locked = role !== null && !screenOpensFor(screen, role);
        const forRoles = screen.public
          ? null
          : PAGE_ROLES[screen.href as ProtectedPage].map((r) => ROLE_LABEL[r]).join(", ");
        return (
          <li key={screen.href} className="border-b border-line">
            <Link
              href={screen.href}
              className={clsx(
                "group flex min-h-[72px] items-center gap-4 px-1 py-4 transition-colors duration-200 ease-out hover:bg-surface sm:gap-6",
                locked && "text-muted",
              )}
            >
              <span className="num w-8 text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1">
                <span className="block font-display text-2xl font-semibold">{screen.label}</span>
                <span className="block text-muted">{screen.detail}</span>
                {locked ? (
                  <span className="mt-1 flex items-start gap-1.5 text-sm">
                    <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    For {forRoles}. Switch account to open it.
                  </span>
                ) : null}
              </span>
              <span className="num hidden text-muted sm:inline">{screen.href}</span>
              <ArrowRight
                aria-hidden
                className="h-6 w-6 transition-transform duration-200 ease-out group-hover:translate-x-1"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
