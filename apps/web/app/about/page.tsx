import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/about/PrintButton";
import { RouteBadge } from "@/components/RouteBadge";
import { Wordmark } from "@/components/Wordmark";
import { DESTINATIONS, NON_SELECTING_GESTURE_LABELS, NON_SELECTING_VOICE_LABELS } from "@/lib/destinations";
import { formatAccuracy, headlineAccuracy, MODEL_STATUS_LABEL, MODELS, type ModelKey } from "@/lib/models";

export const metadata: Metadata = {
  title: "About · Tap&Select",
  description: "How Tap&Select works: a digital waiting list for Kigali's buses.",
};

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid border-t-2 border-ink pt-4 pb-10" aria-labelledby={`s${n}`}>
      <h2 id={`s${n}`} className="flex items-baseline gap-4 text-2xl">
        <span className="num text-base font-normal text-muted">{n}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const JOBS = [
  { step: "Sense", detail: "A passenger taps a card and says their stop or taps a gesture. The board recognises it on-device and the kiosk issues a queue number." },
  { step: "Decide", detail: "Postgres rules watch demand per destination every minute and recommend releasing a bus at 70% load or a 15-minute wait. HQ approves." },
  { step: "Inform", detail: "The kiosk shows the ticket, the bus and its live ETA from the driver's phone GPS. Arrival boards the oldest waiting passengers." },
] as const;

const WHERE = [
  { place: "Board", what: "Arduino Nano 33 BLE Sense Lite: microphone + proximity sensor, two Edge Impulse models, RGB LED. No internet." },
  { place: "Browser", what: "Kiosk page (Chrome, Web Serial over USB), HQ dashboard, bus driver page (phone GPS). Next.js on Vercel." },
  { place: "Cloud", what: "Supabase Postgres: queue numbers, dispatch rules, boarding as SQL functions; Realtime pushes every change; pg_cron runs dispatch each minute." },
] as const;

const REAL = [
  ["Voice and tap-gesture choice", "Real, on the board"],
  ["Kiosk, database, dispatch, dashboard", "Real"],
  ["Bus location", "Real phone GPS (/bus page)"],
  ["Card tap (RFID)", "Simulated: 5 demo cards on screen"],
  ["Bus arrival", "Driver button, GPS radius or HQ button"],
  ["Other stops", "Simulator script"],
] as const;

const HARDWARE = [
  "Arduino Nano 33 BLE Sense Lite (nRF52840, 256 KB RAM): PDM microphone, APDS9960 proximity sensor, RGB LED",
  "Laptop running Chrome as the kiosk screen, board on USB",
  "Any phone with GPS as the bus tracker",
] as const;

const FUTURE = [
  ["RC522 RFID + Tap&Go", "real card taps, linked to Kigali's existing bus cards"],
  ["Camera module", "finger-count gestures instead of taps"],
  ["LTE + solar kiosk", "stand-alone stops with no laptop or mains power"],
  ["Operator GPS", "live positions from the bus operators' own trackers"],
] as const;

function ModelCard({ model, title, sensor }: { model: ModelKey; title: string; sensor: string }) {
  const info = MODELS[model];
  const accuracy = headlineAccuracy(info);
  const stopLabel = (label: string) =>
    DESTINATIONS.find((d) => (model === "voice" ? d.voiceLabel : d.gestureLabel) === label);
  const nonSelecting: readonly string[] = model === "voice" ? NON_SELECTING_VOICE_LABELS : NON_SELECTING_GESTURE_LABELS;

  return (
    <article className="break-inside-avoid rounded-card border border-line bg-surface p-5">
      <h3 className="text-xl">{title}</h3>
      <p className="text-sm text-muted">{sensor}</p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="col-span-2">
          <dt className="text-muted">Status</dt>
          <dd className="font-semibold">{MODEL_STATUS_LABEL[info.status]}</dd>
        </div>
        <div>
          <dt className="text-muted">{accuracy.kind === "test" ? "Test accuracy" : "Validation accuracy"}</dt>
          <dd className="num font-semibold">{formatAccuracy(accuracy.value)}</dd>
        </div>
      </dl>
      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">{title} labels</caption>
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-1.5 font-normal">Label</th>
            <th className="py-1.5 font-normal">Selects</th>
          </tr>
        </thead>
        <tbody>
          {info.labels.map((label) => {
            const d = stopLabel(label);
            return (
              <tr key={label} className="border-b border-line last:border-b-0">
                <td className="num py-1.5">{label}</td>
                <td className="py-1.5">
                  {d ? (
                    <span className="flex items-center gap-2">
                      <RouteBadge code={d.code} size="sm" />
                      {d.name}
                    </span>
                  ) : nonSelecting.includes(label) ? (
                    <span className="text-muted">Nothing (rejected)</span>
                  ) : (
                    <span className="text-danger">Unmapped</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {info.updated ? <p className="mt-3 text-xs text-muted">Exported {info.updated}</p> : null}
    </article>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12 print:max-w-none print:p-0">
      <header className="flex items-center justify-between gap-4 border-b border-line pb-6">
        <Link href="/" aria-label="Tap&Select home">
          <Wordmark />
        </Link>
        <PrintButton />
      </header>

      <div className="py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">About the prototype</p>
        <h1 className="mt-2 text-[40px] leading-[1.05] sm:text-[52px]">
          Passengers in Kigali wait at stops without knowing if a bus is coming, and operators can&rsquo;t see
          who is waiting.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Tap&Select is a digital waiting list: tap a card, say your stop, get a queue number, and HQ sends the bus
          when the queue is ready.
        </p>
      </div>

      <Section n="01" title="Sense → Decide → Inform">
        <ol className="grid gap-4 sm:grid-cols-3">
          {JOBS.map((job, i) => (
            <li key={job.step} className="rounded-card border border-line bg-surface p-5">
              <span className="num text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-xl">{job.step}</h3>
              <p className="mt-2 text-muted">{job.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section n="02" title="What runs where">
        <dl className="divide-y divide-line rounded-card border border-line bg-surface">
          {WHERE.map((row) => (
            <div key={row.place} className="grid gap-1 p-4 sm:grid-cols-[140px_1fr] sm:gap-6">
              <dt className="font-display text-lg font-semibold">{row.place}</dt>
              <dd className="text-muted">{row.what}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section n="03" title="Real vs simulated">
        <table className="w-full rounded-card border border-line bg-surface text-left">
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              <th className="p-3 font-normal">Part</th>
              <th className="p-3 font-normal">In this demo</th>
            </tr>
          </thead>
          <tbody>
            {REAL.map(([part, status]) => (
              <tr key={part} className="border-b border-line last:border-b-0">
                <td className="p-3 font-medium">{part}</td>
                <td className="p-3 text-muted">{status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section n="04" title="The two models on the board">
        <p className="mb-4 max-w-2xl text-muted">
          Both are trained in Edge Impulse and run on the microcontroller itself. A stop is chosen only when one
          label scores at least 0.80 twice in a row; the passenger then confirms on screen.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <ModelCard model="voice" title="Voice keywords" sensor="PDM microphone, 16 kHz, 1 s windows" />
          <ModelCard model="gesture" title="Tap gestures" sensor="APDS9960 proximity + clear light, 20 Hz, 3 s windows" />
        </div>
      </Section>

      <Section n="05" title="Hardware">
        <ul className="list-disc space-y-1 pl-5 text-muted">
          {HARDWARE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section n="06" title="Next upgrades">
        <ul className="grid gap-3 sm:grid-cols-2">
          {FUTURE.map(([name, detail]) => (
            <li key={name} className="rounded-card border border-line bg-surface p-4">
              <span className="font-semibold">{name}</span>
              <span className="block text-muted">{detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      <footer className="border-t border-line pt-6 text-sm text-muted">
        Tap&Select · CMU-Africa Bridge Program · Prototype, not for production use
      </footer>
    </main>
  );
}
