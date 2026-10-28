import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/about/PrintButton";
import {
  BENEFITS,
  BurgerParagraph,
  Cite,
  CLOSING_LINE,
  CONCLUSION,
  FEATURES_TO_BENEFITS,
  FLOW_STEPS,
  REFERENCES,
  ReferenceLine,
  ROADMAP_PHASES,
  SENSE_DECIDE_INFORM,
  TAGLINE,
  TEAM,
  UPGRADES,
} from "@/components/pitch/content";
import { RouteBadge } from "@/components/RouteBadge";
import { Wordmark } from "@/components/Wordmark";
import { DESTINATIONS, NON_SELECTING_VOICE_LABELS } from "@/lib/destinations";
import { formatAccuracy, headlineAccuracy, MODEL_STATUS_LABEL, MODELS } from "@/lib/models";

export const metadata: Metadata = {
  title: "About · Tap&Select",
  description: "How Tap&Select works: making passenger demand visible, so buses move when people are ready.",
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

const REAL = [
  ["Voice choice", "Real: Edge Impulse keyword model on the board"],
  ["Tap choice over the sensor", "Real: rule-based tap detector on the board (a trained tap model is not built yet)"],
  ["Kiosk, database, dispatch, dashboard", "Real"],
  ["Bus location", "Real phone GPS (/bus page)"],
  ["Card tap (RFID)", "Simulated: demo cards on screen"],
  ["Other stops", "Simulator script"],
] as const;

function VoiceModelCard() {
  const info = MODELS.voice;
  const accuracy = headlineAccuracy(info);
  const stopFor = (label: string) => DESTINATIONS.find((d) => d.voiceLabel === label);
  const nonSelecting: readonly string[] = NON_SELECTING_VOICE_LABELS;

  return (
    <article className="break-inside-avoid rounded-card border border-line bg-surface p-5">
      <h3 className="text-xl">Voice keywords</h3>
      <p className="text-sm text-muted">Edge Impulse model · PDM microphone, 16 kHz, 1 s windows</p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="col-span-2">
          <dt className="text-muted">Status</dt>
          <dd className="font-semibold">{MODEL_STATUS_LABEL[info.status]}</dd>
        </div>
        <div>
          <dt className="text-muted">{accuracy.kind === "test" ? "Test accuracy" : "Validation accuracy"}</dt>
          {accuracy.value === null ? (
            <dd className="font-semibold">Pending</dd>
          ) : (
            <dd className="num font-semibold">{formatAccuracy(accuracy.value)}</dd>
          )}
        </div>
      </dl>
      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">Voice labels</caption>
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-1.5 font-normal">Label</th>
            <th className="py-1.5 font-normal">Selects</th>
          </tr>
        </thead>
        <tbody>
          {info.labels.map((label) => {
            const d = stopFor(label);
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
      <p className="mt-3 text-xs text-muted">
        Selects when one stop scores at least 0.80 twice in a row (one result every 250 ms).
        {info.updated ? ` Exported ${info.updated}.` : ""}
      </p>
    </article>
  );
}

function TapRulesCard() {
  return (
    <article className="break-inside-avoid rounded-card border border-line bg-surface p-5">
      <h3 className="text-xl">Taps over the sensor</h3>
      <p className="text-sm text-muted">Rule-based detector (no ML yet) · APDS9960 proximity sensor</p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="col-span-3">
          <dt className="text-muted">Status</dt>
          <dd className="font-semibold">{MODEL_STATUS_LABEL[MODELS.gesture.status]}</dd>
        </div>
      </dl>
      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">Tap patterns</caption>
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-1.5 font-normal">Over the sensor</th>
            <th className="py-1.5 font-normal">Selects</th>
          </tr>
        </thead>
        <tbody>
          {DESTINATIONS.map((d) => (
            <tr key={d.code} className="border-b border-line last:border-b-0">
              <td className="py-1.5">{d.gestureHint}</td>
              <td className="py-1.5">
                <span className="flex items-center gap-2">
                  <RouteBadge code={d.code} size="sm" />
                  {d.name}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">
        A tap is a hand coming within a few centimetres and leaving within 0.6 s; taps less than 0.7 s apart count
        together; a still hand for 1.8 s is a hold. A trained Edge Impulse tap model is planned and the data logger
        for it is ready.
      </p>
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
        <div className="flex items-center gap-3 print:hidden">
          <Link
            href="/pitch"
            className="inline-flex h-12 items-center rounded-card border border-ink px-4 font-semibold transition-colors duration-200 ease-out hover:bg-surface"
          >
            Pitch
          </Link>
          <PrintButton />
        </div>
      </header>

      <div className="py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">
          Problem → Solution → Tech → Conclusion
        </p>
        <h1 className="mt-2 text-[40px] leading-[1.05] sm:text-[52px]">{TAGLINE}</h1>
        <p className="mt-4 text-muted">{TEAM.join(" · ")} · CMU-Africa Bridge Program 2026</p>
      </div>

      <Section n="01" title="The problem: an invisible queue">
        <p className="max-w-2xl text-lg">
          How long did you wait for a bus this week? A Kigali commuter leaves work at 6 PM and reaches home after
          9 PM, and Rwanda&rsquo;s transport regulator has said the average wait can reach one hour.
          <Cite n={1} />
        </p>
        <p className="mt-3 max-w-2xl">
          Buses wait for passengers while passengers wait for buses, because neither side can see the other.
          Off-peak scheduled buses left with only 10&ndash;15 passengers,
          <Cite n={2} /> while at peak and holiday times travellers waited several hours.
          <Cite n={4} /> Furthermore, Kigali needed about 500 buses but had 229 in 2022.
          <Cite n={1} /> Nobody measures who is waiting, where, or for which destination.
        </p>
      </Section>

      <Section n="02" title="Justification">
        <BurgerParagraph size="page" />
      </Section>

      <Section n="03" title="The solution">
        <p className="mb-4 max-w-2xl text-lg font-semibold">
          Every bus stop becomes a sensor. Every bus leaves for a reason.
        </p>
        <ol className="grid gap-4 sm:grid-cols-3">
          {SENSE_DECIDE_INFORM.map((s, i) => (
            <li key={s.step} className="rounded-card border border-line bg-surface p-5">
              <span className="num text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-xl">{s.step}</h3>
              <p className="mt-2">{s.detail}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4">
          Tap&amp;Select works with Generation 2: schedules plus real demand.
          <Cite n={3} />
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.who} className="rounded-card border border-line bg-surface p-5">
              <h3 className="text-lg">{b.who}</h3>
              <p className="mt-1">{b.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="04" title="How it works">
        <ol className="grid gap-3 sm:grid-cols-5">
          {FLOW_STEPS.map((s) => (
            <li key={s.n} className="rounded-card border border-line bg-surface p-4">
              <span className="num text-sm text-muted">{s.n}</span>
              <h3 className="text-base leading-tight">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.detail}</p>
            </li>
          ))}
        </ol>
        <table className="mt-6 w-full text-left text-sm sm:text-base">
          <caption className="sr-only">Features and their benefits</caption>
          <thead>
            <tr className="border-b-2 border-ink text-muted">
              <th className="py-2 pr-4 font-normal">Feature</th>
              <th className="py-2 font-normal">Benefit</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES_TO_BENEFITS.map(([feature, benefit]) => (
              <tr key={feature} className="border-b border-line">
                <td className="py-2 pr-4 font-medium">{feature}</td>
                <td className="py-2">{benefit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <VoiceModelCard />
          <TapRulesCard />
        </div>
        <table className="mt-6 w-full rounded-card border border-line bg-surface text-left">
          <caption className="p-3 text-left text-sm font-semibold uppercase tracking-[0.12em] text-muted">
            Real vs simulated in this prototype
          </caption>
          <tbody>
            {REAL.map(([part, status]) => (
              <tr key={part} className="border-t border-line">
                <td className="p-3 font-medium">{part}</td>
                <td className="p-3 text-muted">{status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section n="05" title="Roadmap">
        <ol className="grid gap-3 sm:grid-cols-3">
          {ROADMAP_PHASES.map((p) => (
            <li key={p.phase} className="rounded-card border border-line bg-surface p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{p.when}</span>
              <h3 className="text-lg">{p.phase}</h3>
              <p className="text-muted">{p.detail}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-muted">Upgrades: {UPGRADES.join(" · ")}.</p>
      </Section>

      <Section n="06" title="Conclusion">
        <dl className="space-y-2">
          {CONCLUSION.map((c) => (
            <div key={c.label} className="grid gap-1 sm:grid-cols-[120px_1fr] sm:gap-4">
              <dt className="font-semibold">{c.label}</dt>
              <dd>{c.text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 font-display text-2xl font-bold leading-tight">{CLOSING_LINE}</p>
      </Section>

      <Section n="07" title="References">
        <ol className="space-y-2 text-sm">
          {REFERENCES.map((r) => (
            <li key={r.n} className="pl-8 -indent-8">
              <ReferenceLine reference={r} />
            </li>
          ))}
        </ol>
      </Section>

      <footer className="border-t border-line pt-6 text-sm text-muted">
        Tap&Select · CMU-Africa Bridge Program · Prototype, not for production use
      </footer>
    </main>
  );
}
