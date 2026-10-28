import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { KigaliClock } from "@/components/KigaliClock";
import { RouteBadge } from "@/components/RouteBadge";
import { Wordmark } from "@/components/Wordmark";
import { DESTINATIONS } from "@/lib/destinations";

const SCREENS = [
  { href: "/kiosk", label: "Kiosk", detail: "Passenger screen at the stop" },
  { href: "/dashboard", label: "Dashboard", detail: "HQ demand and dispatch" },
  { href: "/bus", label: "Bus", detail: "Driver phone, shares GPS" },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Wordmark />
        <div className="text-right">
          <KigaliClock className="block text-2xl font-medium" />
          <span className="text-sm text-muted">Kigali</span>
        </div>
      </header>

      <section className="py-12 sm:py-16">
        <h1 className="text-[40px] leading-[1.05] sm:text-[56px]">
          A digital waiting list for Kigali&rsquo;s buses.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Tap your card, say your stop, and HQ sends the bus when the queue is ready.
        </p>
      </section>

      <nav aria-label="Screens">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
          <span>Screen</span>
          <span>Go</span>
        </div>
        <ul>
          {SCREENS.map((screen, i) => (
            <li key={screen.href} className="border-b border-line">
              <Link
                href={screen.href}
                className="group flex min-h-[72px] items-center gap-4 px-1 py-4 transition-colors duration-200 ease-out hover:bg-surface sm:gap-6"
              >
                <span className="num w-8 text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">
                  <span className="block font-display text-2xl font-semibold">{screen.label}</span>
                  <span className="block text-muted">{screen.detail}</span>
                </span>
                <span className="num hidden text-muted sm:inline">{screen.href}</span>
                <ArrowRight
                  aria-hidden
                  className="h-6 w-6 transition-transform duration-200 ease-out group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <footer className="mt-auto pt-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
          Routes served from Kiosk 1
        </p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DESTINATIONS.map((d) => (
            <li key={d.code} className="flex items-center gap-3">
              <RouteBadge code={d.code} size="sm" />
              <span className="font-medium">{d.name}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted">
          Prototype by the Tap&Select team · CMU-Africa Bridge Program ·{" "}
          <Link href="/about" className="font-semibold text-ink underline underline-offset-4">
            How it works
          </Link>
          {" · "}
          <Link href="/pitch" className="font-semibold text-ink underline underline-offset-4">
            Pitch
          </Link>
        </p>
      </footer>
    </main>
  );
}
