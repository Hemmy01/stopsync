// The 15 pitch slides. Each renders into a fixed 1280×720 canvas that the deck
// scales to the screen, so sizes here are real projector sizes.

import Image from "next/image";
import type { ReactNode } from "react";
import { RouteBadge } from "@/components/RouteBadge";
import { IdeaStoryboard } from "./IdeaStoryboard";
import { JourneyComic } from "./JourneyComic";
import { HomeLink } from "@/components/HomeLink";
import { DESTINATIONS } from "@/lib/destinations";
import { formatAccuracy, MODELS } from "@/lib/models";
import { PITCH_SECTIONS, type PitchSection } from "@/lib/pitch-nav";
import {
  BENEFITS,
  BurgerParagraph,
  Cite,
  CLOSING_LINE,
  CONCLUSION,
  IMPROVEMENTS,
  REALITY,
  RealityBadge,
  REFERENCES,
  ReferenceLine,
  ROADMAP_PHASES,
  SENSE_DECIDE_INFORM,
  TAGLINE,
  TEAM,
  STRONGEST_FEATURES,
  WHAT_RUNS_WHERE,
} from "./content";

export interface Slide {
  title: string;
  section: PitchSection | null;
  speaker: string;
  notes: readonly string[];
  body: ReactNode;
}

/** "Problem · Solution · Tech · Conclusion", the current part marked in ink. */
function Outline({ current }: { current: PitchSection }) {
  return (
    <ol className="flex items-center gap-2 text-[15px] font-semibold uppercase tracking-[0.12em]" aria-label="Pitch outline">
      {PITCH_SECTIONS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          {i > 0 ? <span aria-hidden className="text-muted">→</span> : null}
          <span
            className={s === current ? "border-b-2 border-ink pb-0.5 text-ink" : "text-muted"}
            aria-current={s === current ? "step" : undefined}
          >
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Frame({ section, title, children }: { section: PitchSection; title: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col px-16 pt-12 pb-14">
      <Outline current={section} />
      <h2 className="mt-5 text-[52px] leading-[1.05]">{title}</h2>
      <div className="mt-8 min-h-0 flex-1">{children}</div>
    </div>
  );
}

/** QR code for the public live board (public/pitch/live-qr.svg, made with `npx qrcode`). */
function LiveQr({ size }: { size: number }) {
  return (
    <Image
      src="/pitch/live-qr.svg"
      width={size}
      height={size}
      unoptimized
      alt="QR code: tap-and-select.vercel.app/live"
      className="rounded-md border border-line bg-white p-1"
    />
  );
}

function Card({ heading, children, className = "" }: { heading?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-surface p-6 ${className}`}>
      {heading ? <h3 className="text-[28px] leading-tight">{heading}</h3> : null}
      <div className={heading ? "mt-3 text-[24px] leading-snug text-ink" : "text-[24px] leading-snug text-ink"}>{children}</div>
    </div>
  );
}

const voice = MODELS.voice;
const validation = voice.validationAccuracy;

export const SLIDES: readonly Slide[] = [
  // 1 ---------------------------------------------------------------------
  {
    title: "Tap&Select",
    section: null,
    speaker: "Samira",
    notes: [
      "Samira: slides 1–3 (hook and problem). Kevin: 4 (justification). Kenny: 5–6 (solution, benefits).",
      "Emmanuel: 7–12 (tech, features, ML, real vs simulated, the whole idea, live demo). Hassan: 13–16 (roadmap, conclusion, references, questions).",
      "About 7 minutes plus the demo.",
    ],
    body: (
      <div className="flex h-full flex-col justify-between px-16 py-14">
        <HomeLink />
        <div>
          <h1 className="text-[104px] leading-none">Tap&amp;Select</h1>
          <p className="mt-6 max-w-[900px] text-[34px] leading-snug text-ink">{TAGLINE}</p>
        </div>
        <div className="flex items-end justify-between gap-8 border-t-2 border-ink pt-5 text-[22px]">
          <p className="font-semibold">{TEAM.join(" · ")}</p>
          <p className="text-muted">CMU-Africa Bridge Program 2026</p>
        </div>
      </div>
    ),
  },
  // 2 ---------------------------------------------------------------------
  {
    title: "Hook",
    section: "Problem",
    speaker: "Samira",
    notes: [
      "Ask the question, then pause.",
      "Ask the room to raise a hand if they waited over 20 minutes.",
      "Tell the commuter's story: leaves work at 6 PM, home after 9 PM.",
      "Land the fact: the regulator itself says waits can reach one hour.",
    ],
    body: (
      <Frame section="Problem" title="The problem">
        <p className="text-[64px] font-bold leading-[1.08] font-display">How long did you wait for a bus this week?</p>
        <div className="mt-12 grid grid-cols-2 gap-6">
          <Card heading="A story">
            A Kigali commuter leaves work at 6 PM and reaches home after 9 PM.
            <Cite n={1} />
          </Card>
          <Card heading="A surprising fact">
            Rwanda&rsquo;s transport regulator has said the average wait can reach one hour.
            <Cite n={1} />
          </Card>
        </div>
      </Frame>
    ),
  },
  // 3 ---------------------------------------------------------------------
  {
    title: "The invisible queue",
    section: "Problem",
    speaker: "Samira",
    notes: [
      "Read the topic line slowly: both sides are waiting, and neither can see the other.",
      "Three cards: empty off-peak buses, hours-long peaks, and too few buses overall.",
      "Close on the footer: nobody measures who is waiting. That's the gap we fill.",
    ],
    body: (
      <Frame section="Problem" title="The invisible queue">
        <p className="max-w-[1080px] text-[30px] leading-snug">
          Buses wait for passengers while passengers wait for buses, because neither side can see the other.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-5">
          <Card>
            <span className="num block text-[56px] font-bold leading-none">10&ndash;15</span>
            <span className="mt-3 block">
              Off-peak scheduled buses left with only 10&ndash;15 passengers.
              <Cite n={2} />
            </span>
          </Card>
          <Card>
            <span className="block text-[56px] font-bold leading-none font-display">Hours</span>
            <span className="mt-3 block">
              At peak and holiday times, travellers waited several hours.
              <Cite n={4} />
            </span>
          </Card>
          <Card>
            <span className="num block text-[56px] font-bold leading-none">229 / 500</span>
            <span className="mt-3 block">
              Kigali needed about 500 buses but had 229 in 2022.
              <Cite n={1} />
            </span>
          </Card>
        </div>
        <p className="mt-8 border-t-2 border-ink pt-4 text-[26px] font-semibold">
          Nobody measures who is waiting, where, or for which destination.
        </p>
      </Frame>
    ),
  },
  // 4 ---------------------------------------------------------------------
  {
    title: "Justification",
    section: "Problem",
    speaker: "Kevin",
    notes: [
      "This is our formal justification, in burger structure: topic, development, evidence, summary.",
      "Stress the linking words: However, In contrast, Furthermore, Therefore.",
      "Key point: Generation 2 schedules are planned ahead; demand changes by hour, stop and destination.",
    ],
    body: (
      <Frame section="Problem" title="Why Kigali needs it">
        <BurgerParagraph />
      </Frame>
    ),
  },
  // 5 ---------------------------------------------------------------------
  {
    title: "The solution",
    section: "Solution",
    speaker: "Kenny",
    notes: [
      "Read the vision line, then walk the three columns left to right.",
      "Sense is the kiosk; Decide is HQ with a human approving; Inform is the passenger's ticket and ETA.",
      "We complement Generation 2: schedules plus real demand.",
    ],
    body: (
      <Frame section="Solution" title="Every bus stop becomes a sensor. Every bus leaves for a reason.">
        <ol className="grid grid-cols-3 gap-5">
          {SENSE_DECIDE_INFORM.map((s, i) => (
            <li key={s.step} className="rounded-card border border-line bg-surface p-6">
              <span className="num text-[20px] text-muted">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-1 text-[36px]">{s.step}</h3>
              <p className="mt-3 text-[24px] leading-snug">{s.detail}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-[26px]">
          Tap&amp;Select works with Generation 2: schedules plus real demand.
          <Cite n={3} />
        </p>
      </Frame>
    ),
  },
  // 6 ---------------------------------------------------------------------
  {
    title: "Benefits",
    section: "Solution",
    speaker: "Kenny",
    notes: [
      "Passengers: fairness and certainty, no smartphone needed. Choosing the stop is hands-free; confirming is one big button on screen.",
      "Operators: the aim is fuller buses and less fuel wasted on empty trips. We haven't measured that yet; a pilot would.",
      "City and RURA: data to reach the 50% public-transport goal.",
    ],
    body: (
      <Frame section="Solution" title="Benefits to the customer">
        <div className="grid grid-cols-3 gap-5">
          {BENEFITS.map((b) => (
            <Card key={b.who} heading={b.who} className="h-full">
              {b.text}
            </Card>
          ))}
        </div>
      </Frame>
    ),
  },
  // 7 ---------------------------------------------------------------------
  {
    title: "How it works",
    section: "Tech",
    speaker: "Emmanuel",
    notes: [
      "Walk the comic left to right: one passenger, five steps. The drawings explain the idea; the live demo shows the real thing.",
      "In the prototype the card reader is simulated on screen; the voice and swipes are real. SELECT,REM is the actual line the board sends.",
      "Recognition happens on the Arduino itself, not in the cloud.",
      "The browser is only a gateway; the rules live in the cloud database.",
    ],
    body: (
      <Frame section="Tech" title="How it works">
        <JourneyComic />
        <dl className="mt-8 grid grid-cols-3 divide-x divide-line rounded-card border border-line bg-surface">
          {WHAT_RUNS_WHERE.map((w) => (
            <div key={w.place} className="p-5">
              <dt className="text-[24px] font-semibold font-display">{w.place}</dt>
              <dd className="mt-1 text-[21px] text-muted">{w.what}</dd>
            </div>
          ))}
        </dl>
      </Frame>
    ),
  },
  // 8 ---------------------------------------------------------------------
  {
    title: "Strongest features first",
    section: "Tech",
    speaker: "Emmanuel",
    notes: [
      "Ranked by how complete and how valuable each feature is. The top three work end to end today.",
      "Each row says honestly whether it is real, rule-based or estimated.",
      "Swipes are not machine learning: the sensor detects direction itself. We measured 85–95% per direction, 20 tries each, one tester.",
      "Hands-free means choosing the stop. Confirm and cancel are on-screen buttons; say so if asked.",
      "The voice model runs on the board, but its accuracy is not measured yet. Say that plainly.",
    ],
    body: (
      <Frame section="Tech" title="What it does, strongest first">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b-2 border-ink text-[15px] uppercase tracking-[0.1em] text-muted">
              <th className="w-8 pb-1.5 font-semibold" aria-label="Rank" />
              <th className="pb-1.5 font-semibold">Feature and how it works</th>
              <th className="pb-1.5 font-semibold">Benefit</th>
              <th className="pb-1.5 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {STRONGEST_FEATURES.map((f, i) => (
              <tr key={f.feature} className="border-b border-line align-top">
                <td className="num py-1.5 text-[18px] text-muted">{i + 1}</td>
                <td className="py-1.5 pr-4">
                  <span className="block text-[19px] font-semibold leading-tight">{f.feature}</span>
                  <span className="block text-[14px] leading-snug text-muted">{f.how}</span>
                </td>
                <td className="py-1.5 pr-3 text-[17px] leading-snug">{f.benefit}</td>
                <td className="py-1.5 text-right">
                  <RealityBadge reality={f.reality} className="text-[14px]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Frame>
    ),
  },
  // 9 ---------------------------------------------------------------------
  {
    title: "Our machine learning",
    section: "Tech",
    speaker: "Emmanuel",
    notes: [
      "Keyword spotting in Edge Impulse: four stop names plus noise and unknown, so silence and chatter never select.",
      "About 30 minutes of our own voices, mostly recorded on the board's microphone.",
      "It runs on the microcontroller: int8 + EON, ~20 KB RAM, ~0.4 s per window.",
      "Be honest about the limit: unseen voices are harder; more voices and accents next.",
    ],
    body: (
      <Frame section="Tech" title="Our machine learning">
        <div className="grid grid-cols-[1.25fr_1fr] gap-6">
          <div className="space-y-3">
            <Card className="!p-5" heading="Edge Impulse keyword spotting, 6 classes">
              <span className="mt-1 flex flex-wrap gap-2">
                {DESTINATIONS.map((d) => (
                  <span key={d.code} className="flex items-center gap-2 rounded-pill border border-line px-3 py-0.5 text-[20px]">
                    <RouteBadge code={d.code} size="sm" />
                    {d.name}
                  </span>
                ))}
                <span className="rounded-pill border border-line px-3 py-0.5 text-[20px]">noise</span>
                <span className="rounded-pill border border-line px-3 py-0.5 text-[20px]">unknown</span>
              </span>
            </Card>
            <Card className="!p-5" heading="Dataset">
              About 30 minutes of audio from 4 team voices, recorded mainly on the board&rsquo;s own microphone, split
              into about 1,100 one-second samples.
            </Card>
          </div>
          <div className="space-y-3">
            <Card className="!p-5">
              <span className="text-[19px] font-semibold uppercase tracking-[0.1em] text-muted">Validation accuracy</span>
              {validation === null ? (
                <span className="mt-1 block text-[48px] font-bold leading-none font-display">Pending</span>
              ) : (
                <span className="num mt-1 block text-[64px] font-bold leading-none">{formatAccuracy(validation)}</span>
              )}
            </Card>
            <Card className="!p-5" heading="On the board">
              int8 + EON compiler · about 20 KB RAM and 31 KB flash · about 0.4 s per 1-second window. Fits easily on a
              256 KB RAM board.
            </Card>
          </div>
        </div>
        <p className="mt-4 rounded-card border-2 border-ink px-5 py-2.5 text-[21px] leading-snug">
          <span className="font-semibold">What we learned: </span>
          Accuracy is lower on voices the model has never heard. Next: more voices and accents, recorded at real bus
          stops.
        </p>
      </Frame>
    ),
  },
  // 10 --------------------------------------------------------------------
  {
    title: "Real vs simulated",
    section: "Tech",
    speaker: "Emmanuel",
    notes: [
      "Be upfront: judges trust a team that says what is simulated.",
      "Real: the board's voice model and swipes, the whole queue and dispatch system, phone GPS, roles.",
      "Estimated: ETA uses a fixed average speed; seats are counted from tickets; our thresholds are guesses until a pilot.",
      "Simulated: the card tap, other stops, and the indoor drive button. All data so far is from our tests.",
    ],
    body: (
      <Frame section="Tech" title="What is real, estimated, simulated, not built">
        <div className="grid grid-cols-4 gap-4">
          {REALITY.map((group) => (
            <section key={group.kind} className="rounded-card border border-line bg-surface p-4">
              <RealityBadge reality={group.kind} className="text-[17px]" />
              <ul className="mt-3 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item} className="text-[18px] leading-snug">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Frame>
    ),
  },
  // 11 --------------------------------------------------------------------
  {
    title: "The whole idea",
    section: "Tech",
    speaker: "Emmanuel",
    notes: [
      "Before the demo, tell the story once: Sense (1), Decide (2–3), Inform (4–5), Next (6).",
      "Say: these are drawings of the idea; the next slide shows the working prototype doing panels 1 to 5.",
      "Panel 6 is the vision, not built: a pilot on one route first.",
    ],
    body: (
      <Frame section="Tech" title="The whole idea, start to finish">
        <IdeaStoryboard />
      </Frame>
    ),
  },
  // 12 --------------------------------------------------------------------
  {
    title: "Live demo",
    section: "Tech",
    speaker: "Emmanuel",
    notes: [
      "Kiosk: tap the card reader → Test card → say “Remera” or swipe left → Confirm → ticket (it is read out loud).",
      "Dashboard: Approve the release recommendation → kiosk shows the bus and ETA.",
      "Simulate drive (or the driver's phone GPS): the bus moves on the map, then Now boarding with the ticket called out.",
      "Invite the room to scan the QR code (opens /live, no sign-in) before you start. Come back with ← or Alt+Tab.",
      "Fallback: tap a stop on screen if the room is noisy.",
    ],
    body: (
      <Frame section="Tech" title="Live demo">
        <p className="text-[28px]">A passenger, a queue number, and a bus released by HQ, live.</p>
        <div className="mt-8 grid grid-cols-3 gap-6">
          <a
            href="/kiosk"
            target="_blank"
            rel="noreferrer"
            className="flex h-40 flex-col justify-center rounded-card bg-accent px-8 text-paper transition-colors duration-200 ease-out hover:bg-ink"
          >
            <span className="text-[32px] font-bold font-display">Open kiosk</span>
            <span className="num text-[20px] opacity-90">/kiosk</span>
          </a>
          <a
            href="/dashboard"
            target="_blank"
            rel="noreferrer"
            className="flex h-40 flex-col justify-center rounded-card border-2 border-ink bg-surface px-8 transition-colors duration-200 ease-out hover:bg-paper"
          >
            <span className="text-[32px] font-bold font-display">HQ dashboard</span>
            <span className="num text-[20px] text-muted">/dashboard</span>
          </a>
          <a
            href="/live"
            target="_blank"
            rel="noreferrer"
            className="flex h-40 flex-col justify-center rounded-card border-2 border-ink bg-surface px-8 transition-colors duration-200 ease-out hover:bg-paper"
          >
            <span className="text-[32px] font-bold font-display">Live board</span>
            <span className="num text-[20px] text-muted">/live · no sign-in</span>
          </a>
        </div>
        <ol className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[21px] text-muted">
          {["Tap card", "Say “Remera” or swipe", "Confirm", "Ticket", "HQ approves", "Bus drives (GPS)", "Now boarding"].map(
            (step, i, all) => (
              <li key={step} className="flex items-center gap-3">
                <span className="text-ink">{step}</span>
                {i < all.length - 1 ? <span aria-hidden>→</span> : null}
              </li>
            ),
          )}
        </ol>
        <div className="mt-8 flex items-center gap-6 rounded-card border-2 border-ink bg-surface px-6 py-3">
          <LiveQr size={120} />
          <p className="text-[26px] leading-snug">
            Scan to follow along on your phone
            <span className="num block font-bold">tap-and-select.vercel.app/live</span>
            <span className="block text-[19px] text-muted">No sign-in. Watch the queue and the bus move live.</span>
          </p>
        </div>
      </Frame>
    ),
  },
  // 13 --------------------------------------------------------------------
  {
    title: "Roadmap",
    section: "Conclusion",
    speaker: "Hassan",
    notes: [
      "Today is a working prototype at one kiosk.",
      "Next, a pilot at 2–3 stops on one route, then the city.",
      "Improvements, most important first: measure and grow the voice model, a one-week pilot at a real stop, a real card reader, exact seat counts, traffic-aware ETA, a street-ready kiosk.",
    ],
    body: (
      <Frame section="Conclusion" title="Roadmap and what we must improve">
        <ol className="relative grid grid-cols-3 gap-6">
          <span aria-hidden className="absolute top-[22px] right-[16%] left-[16%] h-0.5 bg-ink" />
          {ROADMAP_PHASES.map((p, i) => (
            <li key={p.phase} className="relative flex flex-col items-center text-center">
              <span
                className={
                  i === 0
                    ? "num z-10 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-[20px] font-bold text-paper"
                    : "num z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-paper text-[20px] font-bold"
                }
              >
                {i + 1}
              </span>
              <span className="mt-3 text-[17px] font-semibold uppercase tracking-[0.12em] text-muted">{p.when}</span>
              <h3 className="text-[34px]">{p.phase}</h3>
              <p className="mt-1 text-[22px]">{p.detail}</p>
            </li>
          ))}
        </ol>
        <h3 className="mt-6 text-[17px] font-semibold uppercase tracking-[0.12em] text-muted">
          Improvements we need, most important first
        </h3>
        <ol className="mt-3 grid grid-cols-3 gap-3">
          {IMPROVEMENTS.map((u, i) => (
            <li key={u.what} className="rounded-card border border-line bg-surface px-4 py-2.5">
              <span className="block text-[20px] font-semibold leading-tight">
                <span className="num mr-2 text-muted">{i + 1}</span>
                {u.what}
              </span>
              <span className="mt-0.5 block text-[16px] leading-snug text-muted">{u.why}</span>
            </li>
          ))}
        </ol>
      </Frame>
    ),
  },
  // 14 --------------------------------------------------------------------
  {
    title: "Conclusion",
    section: "Conclusion",
    speaker: "Hassan",
    notes: [
      "Summarise in three lines: problem, solution, tech.",
      "Pause, then read the last line slowly. That is the sentence they should remember.",
    ],
    body: (
      <Frame section="Conclusion" title="Conclusion">
        <dl className="space-y-3">
          {CONCLUSION.map((c) => (
            <div key={c.label} className="grid grid-cols-[180px_1fr] gap-6 border-b border-line pb-3">
              <dt className="text-[24px] font-semibold font-display">{c.label}</dt>
              <dd className="text-[24px] leading-snug">{c.text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-[46px] font-bold leading-[1.12] font-display">{CLOSING_LINE}</p>
      </Frame>
    ),
  },
  // 15 --------------------------------------------------------------------
  {
    title: "References",
    section: "Conclusion",
    speaker: "Hassan",
    notes: ["Every number in the pitch comes from these six sources.", "Leave it up briefly; judges can read it on /about later."],
    body: (
      <Frame section="Conclusion" title="References">
        <ol className="space-y-3 text-[19px] leading-snug">
          {REFERENCES.map((r) => (
            <li key={r.n} className="pl-12 -indent-12">
              <ReferenceLine reference={r} />
            </li>
          ))}
        </ol>
      </Frame>
    ),
  },
  // 16 --------------------------------------------------------------------
  {
    title: "Thank you",
    section: null,
    speaker: "Hassan",
    notes: ["Thank the judges in Kinyarwanda and English.", "Invite questions; the demo stays open for follow-ups."],
    body: (
      <div className="flex h-full flex-col justify-between px-16 py-14">
        <div className="flex items-start justify-between">
          <HomeLink />
          <figure className="text-center">
            <LiveQr size={130} />
            <figcaption className="num mt-1 text-[16px] text-muted">/live</figcaption>
          </figure>
        </div>
        <div>
          <p className="text-[96px] font-bold leading-none font-display">Murakoze. Thank you.</p>
          <p className="mt-8 text-[44px] font-semibold text-muted">Questions?</p>
        </div>
        <p className="border-t-2 border-ink pt-5 text-[22px] font-semibold">{TEAM.join(" · ")}</p>
      </div>
    ),
  },
];
