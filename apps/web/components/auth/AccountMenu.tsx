"use client";

import clsx from "clsx";
import { Check, ChevronDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ROLE_LABEL, type Account } from "@/lib/auth";
import { SCREENS, screenOpensFor } from "@/lib/screens";
import { signOut } from "@/lib/use-account";

interface AccountMenuProps {
  account: Account;
  className?: string;
  /** Icon only (phones, the kiosk bar). */
  compact?: boolean;
}

/**
 * Who is signed in, as a menu: jump to any screen this role can open, or sign out. Signing
 * out lands on /login with this page as `next`, so another (demo) role can pick up here.
 */
export function AccountMenu({ account, className, compact = false }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const leave = async () => {
    setSigningOut(true);
    await signOut();
    router.replace(pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`);
  };

  const screens = SCREENS.filter((s) => screenOpensFor(s, account.role));
  const roleLine = `${ROLE_LABEL[account.role]}${account.busId ? ` · ${account.busId}` : ""}`;

  return (
    <div ref={root} className={clsx("relative text-sm", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "inline-flex h-11 items-center gap-2 rounded-card border border-line bg-surface text-left transition-colors duration-200 ease-out hover:border-ink",
          compact ? "w-11 justify-center" : "px-3",
        )}
      >
        <UserRound aria-hidden className="h-4 w-4 shrink-0 text-muted" />
        <span className={clsx("min-w-0 leading-tight", compact && "sr-only")}>
          <span className="block max-w-[160px] truncate font-semibold">{account.name}</span>
          <span className="block text-xs text-muted">{roleLine}</span>
        </span>
        {compact ? null : <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-muted" />}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-72 max-w-[calc(100vw-32px)] rounded-card border border-line bg-surface p-2 shadow-sm"
        >
          <p className="px-3 pt-1 pb-2 text-xs text-muted">
            Signed in as <span className="font-semibold text-ink">{account.email}</span>
            <br />
            {roleLine}
          </p>
          <p className="border-t border-line px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Go to
          </p>
          <ul>
            {screens.map((s) => {
              const here = pathname === s.href;
              return (
                <li key={s.href}>
                  <Link
                    role="menuitem"
                    href={s.href}
                    aria-current={here ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 hover:bg-paper"
                  >
                    <span className="flex-1">
                      <span className="block font-semibold">{s.label}</span>
                      <span className="block text-xs text-muted">{s.detail}</span>
                    </span>
                    {here ? <Check aria-label="You are here" className="h-4 w-4 text-accent" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            role="menuitem"
            onClick={() => void leave()}
            disabled={signingOut}
            className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-lg border-t border-line px-3 font-semibold text-danger hover:bg-paper disabled:opacity-60"
          >
            <LogOut aria-hidden className="h-4 w-4" />
            {signingOut ? "Signing out…" : "Sign out or switch account"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
