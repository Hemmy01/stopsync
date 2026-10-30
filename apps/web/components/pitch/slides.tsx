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
  BENEFITS_SHORT,
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
  // 1 --------------------------------------------------------------------
  {
    title: "Tap&Select",
    section: null,
    speaker: "Samira",
    notes: [
      "Samira: 1–2 (hook, problem). Kevin: 3 (justification). Kenny: 4 (solution and benefits).",
      "Emmanuel: 5–9 (how it works, what's real, recognition, the whole idea, live demo). Hassan: 10–13 (roadmap, conclusion, references, questions).",
      "About 5 minutes of slides plus a 3-minute demo. Each speaker: one idea per slide, no reading.",
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
  // 2 --------------------------------------------------------------------
  {
    title: "The problem",
    section: "Problem",
    speaker: "Samira",
    notes: [
      "Ask the question, pause, and ask for a show of hands: who waited more than 20 minutes?",
      "Story: a Kigali commuter leaves work at 6 PM and gets home after 9 PM [1].",
      "Three numbers: waits up to an hour, half the buses the city needs, near-empty buses off-peak.",
      "Land the gap: nobody measures who is waiting.",
    ],
    body: (
      <Frame section="Problem" title="How long did you wait for a bus this week?">
        <p className="max-w-[1080px] text-[30px] leading-snug">
          Buses wait for passengers while passengers wait for buses, because neither side can see the other.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-5">
          <Card>
            <span className="num block text-[56px] font-bold leading-none">1 hour</span>
            <span className="mt-3 block">
              Average wait can reach an hour, says the regulator.
              <Cite n={1} />
            </span>
          </Card>
          <Card>
            <span className="num block text-[56px] font-bold leading-none">229 / 500</span>
            <span className="mt-3 block">
              Buses Kigali had in 2022, against about 500 needed.
              <Cite n={1} />
            </span>
          </Card>
          <Card>
            <span className="num block text-[56px] font-bold leading-none">10&ndash;15</span>
            <span className="mt-3 block">
              Passengers on some off-peak scheduled buses.
              <Cite n={2} />
            </span>
          </Card>
        </div>
        <p className="mt-8 border-t-2 border-ink pt-4 text-[26px] font-semibold">
          Nobody measures who is waiting, where, or for which destination.
        </p>
      </Frame>
    ),
  },
  // 3 --------------------------------------------------------------------
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
  // 4 --------------------------------------------------------------------
  {
    title: "The solution",
    section: "Solution",
    speaker: "Kenny",
    notes: [
      "Read the vision line, then the three steps left to right: Sense is the kiosk, Decide is HQ with a person approving, Inform is the ticket and ETA.",
      "Then who gains, one line each. Operator gains are our aim; a pilot would measure them.",
      "We complement Generation 2: schedules plus real demand.",
    ],
    body: (
      <Frame section="Solution" title="Every bus stop becomes a sensor. Every bus leaves for a reason.">
        <ol className="grid grid-cols-3 gap-5">
          {SENSE_DECIDE_INFORM.map((s, i) => (
            <li key={s.step} className="rounded-card border border-line bg-surface p-5">
              <span className="num text-[20px] text-muted">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-1 text-[34px]">{s.step}</h3>
              <p className="mt-2 text-[23px] leading-snug">{s.detail}</p>
            </li>
          ))}
        </ol>
        <dl className="mt-6 grid grid-cols-3 divide-x divide-line rounded-card border border-line bg-surface">
          {BENEFITS_SHORT.map((b) => (
            <div key={b.who} className="px-5 py-4">
              <dt className="text-[17px] font-semibold uppercase tracking-[0.1em] text-muted">{b.who}</dt>
              <dd className="mt-1 text-[21px] leading-snug">{b.text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-[24px]">
          Tap&amp;Select works with Generation 2: schedules plus real demand.
          <Cite n={3} />
        </p>
      </Frame>
    ),
  },
  // 5 --------------------------------------------------------------------
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
  // 6 --------------------------------------------------------------------
  {
    title: "What works today",
    section: "Tech",
    speaker: "Emmanuel",
    notes: [
      "Lead with the three strongest features: they work end to end today.",
      "Then be upfront: judges trust a team that says what is simulated.",
      "Real: the board's voice model and swipes, the whole queue and dispatch system, phone GPS, roles.",
      "Estimated: ETA uses a fixed average speed; seats are counted from tickets; our thresholds are guesses until a pilot.",
      "Simulated: the card tap, other stops, and the indoor drive button. All data so far is from our tests.",
    ],
    body: (
      <Frame section="Tech" title="What works today, and what doesn’t yet">
        <p className="mb-5 text-[24px] leading-snug">
          <span className="font-semibold">Strongest, working end to end: </span>
          live demand → dispatch loop · fair first-come queue · live bus tracking
        </p>
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
  // 7 --------------------------------------------------------------------
  {
    title: "On-device recognition",
    section: "Tech",
    speaker: "Emmanuel",
    notes: [
      "Voice: Edge Impulse keyword spotting with four stop names plus noise and unknown, so chatter never selects.",
      "It runs on the microcontroller itself, so no audio leaves the board.",
      "Swipes are not ML: the sensor reads the direction. We measured them; the voice model is not measured yet. Say so.",
      "Confirm the dataset size and the on-board figures from Edge Impulse before presenting.",
    ],
    body: (
      <Frame section="Tech" title="On-device recognition">
        <div className="grid grid-cols-2 gap-5">
          <Card heading="Voice: Edge Impulse keyword model">
            <span className="flex flex-wrap gap-2">
              {DESTINATIONS.map((d) => (
                <span key={d.code} className="flex items-center gap-2 rounded-pill border border-line px-3 py-0.5 text-[20px]">
                  <RouteBadge code={d.code} size="sm" />
                  {d.name}
                </span>
              ))}
              <span className="rounded-pill border border-line px-3 py-0.5 text-[20px]">noise</span>
              <span className="rounded-pill border border-line px-3 py-0.5 text-[20px]">unknown</span>
            </span>
            <span className="mt-3 block text-[21px] text-muted">
              Runs on the Arduino: int8, about 20 KB RAM, about 0.4 s per window.
            </span>
            <span className="mt-2 block text-[21px]">
              Accuracy:{" "}
              {validation === null ? (
                <span className="font-semibold">not measured yet</span>
              ) : (
                <span className="num font-semibold">{formatAccuracy(validation)}</span>
              )}
            </span>
          </Card>
          <Card heading="Swipes: read by the sensor, no ML">
            <span className="num block text-[64px] font-bold leading-none">85&ndash;95%</span>
            <span className="mt-2 block text-[21px] text-muted">
              Correct per direction, 20 tries each, one tester. Doing nothing never selected a stop.
            </span>
          </Card>
        </div>
        <p className="mt-6 rounded-card border-2 border-ink px-5 py-3 text-[22px] leading-snug">
          <span className="font-semibold">What we learned: </span>
          voices the model has never heard are harder. Next: more voices and accents, recorded at real stops.
        </p>
      </Frame>
    ),
  },
  // 8 --------------------------------------------------------------------
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
  // 9 --------------------------------------------------------------------
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
  // 10 -------------------------------------------------------------------
  {
    title: "Roadmap",
    section: "Conclusion",
    speaker: "Hassan",
    notes: [
      "Today is a working prototype at one kiosk.",
      "Next, a pilot at 2–3 stops on one route, then the city.",
      "Top three improvements: measure and grow the voice model, a one-week pilot at a real stop, a real card reader. The full list is on /about.",
    ],
    body: (
      <Frame section="Conclusion" title="Roadmap">
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
          Top three improvements
        </h3>
        <ol className="mt-3 grid grid-cols-3 gap-3">
          {IMPROVEMENTS.slice(0, 3).map((u, i) => (
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
  // 11 -------------------------------------------------------------------
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
  // 12 -------------------------------------------------------------------
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
  // 13 -------------------------------------------------------------------
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
