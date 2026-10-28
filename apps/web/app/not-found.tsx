import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <Wordmark />
      <p className="num mt-10 text-[96px] font-bold leading-none">404</p>
      <h1 className="mt-4 text-[40px] leading-tight">This stop isn&rsquo;t on the map.</h1>
      <p className="mt-3 text-lg text-muted">The page you asked for doesn&rsquo;t exist.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {[
          ["/kiosk", "Kiosk"],
          ["/dashboard", "Dashboard"],
          ["/bus", "Bus"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="inline-flex h-14 items-center rounded-card border border-line bg-surface px-6 font-semibold hover:border-ink"
          >
            {label}
          </Link>
        ))}
      </div>
    </main>
  );
}
