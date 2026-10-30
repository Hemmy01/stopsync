// The pitch story, shared by /pitch (slides) and /about (written version), so the
// two never disagree. Every factual claim carries an IEEE citation [n] that points
// into REFERENCES; numbers come only from these sources or content/models.json.

import type { ReactNode } from "react";

/** IEEE in-text citation, e.g. [1]. Small and muted, never the focus. */
export function Cite({ n }: { n: number | readonly number[] }) {
  const list = typeof n === "number" ? [n] : n;
  return (
    <span className="num ml-1 align-baseline text-[0.62em] font-medium text-muted">
      [{list.join("], [")}]
    </span>
  );
}

export interface Reference {
  n: number;
  /** "Author initials. Surname." or an organisation. */
  author: string;
  /** "(2022, Aug. 10)" */
  date: string;
  title: string;
  url: string;
}

export const REFERENCES: readonly Reference[] = [
  {
    n: 1,
    author: "W. Buningwire.",
    date: "(2022, Aug. 10).",
    title: "Kigali struggling to bridge gap in public transport",
    url: "https://www.ktpress.rw/2022/08/kigali-struggling-to-bridge-gap-in-public-transport/",
  },
  {
    n: 2,
    author: "The New Times.",
    date: "(2025, Jan. 21).",
    title: "Rwanda: What commuters make of Kigali's scheduled public transport system",
    url: "https://allafrica.com/stories/202501210080.html",
  },
  {
    n: 3,
    author: "A. Ishimwe.",
    date: "(2025, Dec. 9).",
    title: "Rwanda: Kigali commuters hail new public transport model",
    url: "https://allafrica.com/stories/202512090228.html",
  },
  {
    n: 4,
    author: "AllAfrica.",
    date: "(2025, Dec. 24).",
    title: "Rwanda: Christmas travel surge causes long delays at Kigali bus stations",
    url: "https://allafrica.com/stories/202512240312.html",
  },
  {
    n: 5,
    author: "The New Times.",
    date: "(2026, Jun. 29).",
    title: "Rwanda: Kigali plans to double public transport use in 10 years",
    url: "https://allafrica.com/stories/202606290083.html",
  },
  {
    n: 6,
    author: "O. Paul and P. McSharry.",
    date: "(2021, May 25).",
    title: "Public transportation demand analysis: A case study of metropolitan Lagos",
    url: "https://arxiv.org/abs/2105.11816",
  },
];

/** One reference in IEEE web-page format. */
export function ReferenceLine({ reference: r }: { reference: Reference }) {
  return (
    <>
      <span className="num">[{r.n}]</span> {r.author} {r.date} <em>{r.title}</em> [Online]. Available:{" "}
      <a href={r.url} className="break-all underline underline-offset-2" target="_blank" rel="noreferrer">
        {r.url}
      </a>
    </>
  );
}

export const TEAM = ["Emmanuel", "Samira", "Kevin", "Kenny", "Hassan"] as const;

export const TAGLINE = "Making passenger demand visible, so buses move when people are ready.";

// ---------------------------------------------------------------------------
// Justification paragraph ("burger": Topic → Development → Evidence → Summary)
// ---------------------------------------------------------------------------

export type BurgerPart = "Topic" | "Development" | "Evidence" | "Summary";

/** Lesson colours: blue Topic, green Development, amber Evidence, red Summary. */
export const BURGER_COLOUR: Record<BurgerPart, string> = {
  Topic: "var(--route-1)",
  Development: "var(--route-2)",
  Evidence: "var(--warn)",
  Summary: "var(--danger)",
};

export const JUSTIFICATION: readonly { part: BurgerPart; text: ReactNode }[] = [
  {
    part: "Topic",
    text: (
      <>
        Kigali&rsquo;s buses cannot see where passengers are waiting, so they often run either too empty or too
        full.
      </>
    ),
  },
  {
    part: "Development",
    text: (
      <>
        In December 2025 the city launched &ldquo;Generation 2&rdquo;, with scheduled departures and real-time bus
        tracking.
        <Cite n={3} /> However, a schedule is planned in advance, while demand changes by hour, stop and
        destination.
      </>
    ),
  },
  {
    part: "Evidence",
    text: (
      <>
        During the scheduled-service pilot, off-peak buses left with only 10&ndash;15 passengers, and commuters
        asked for schedules adjusted to demand.
        <Cite n={2} /> In contrast, during the 2025 holiday peak, demand exceeded bus capacity and travellers
        waited several hours.
        <Cite n={4} /> Furthermore, research in Lagos found that demand-based scheduling could cut average waiting
        time by up to 80% in simulation.
        <Cite n={6} />
      </>
    ),
  },
  {
    part: "Summary",
    text: (
      <>
        Therefore, Kigali needs more than extra buses; it needs to know who is waiting, so every bus leaves for a
        reason.
      </>
    ),
  },
];

/** The paragraph as prose, with small coloured margin tags naming each part. */
export function BurgerParagraph({ size = "slide" }: { size?: "slide" | "page" }) {
  const slide = size === "slide";
  return (
    <div className={slide ? "space-y-1" : "space-y-1.5"}>
      {JUSTIFICATION.map(({ part, text }) => (
        <div key={part} className={slide ? "grid grid-cols-[150px_1fr] gap-5" : "grid gap-1 sm:grid-cols-[120px_1fr] sm:gap-4"}>
          <span
            className={
              slide
                ? "mt-1.5 self-start border-l-4 pl-2 text-[15px] font-semibold uppercase tracking-[0.1em] text-ink"
                : "self-start border-l-4 pl-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink sm:mt-1"
            }
            style={{ borderColor: BURGER_COLOUR[part] }}
          >
            {part === "Topic" ? "Topic sentence" : part === "Evidence" ? "Example / evidence" : part}
          </span>
          <p className={slide ? "text-[23px] leading-[1.45] text-ink" : "text-ink"}>{text}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Solution, benefits, conclusion
// ---------------------------------------------------------------------------

export const SENSE_DECIDE_INFORM = [
  { step: "Sense", detail: "The kiosk counts who is waiting and where they are going." },
  { step: "Decide", detail: "HQ gets a live “release a bus” recommendation and approves it." },
  { step: "Inform", detail: "Passengers get a fair queue number and a live ETA." },
] as const;

export const BENEFITS: readonly { who: string; text: ReactNode }[] = [
  {
    who: "Passengers",
    text: (
      <>
        A fair place in line, a live ETA, no smartphone needed. They can choose by voice or a simple tap, so it
        works for people who can&rsquo;t read the screen.
      </>
    ),
  },
  {
    who: "Operators",
    text: <>Fuller buses, fewer empty off-peak trips, less fuel wasted.</>,
  },
  {
    who: "City and RURA",
    text: (
      <>
        Live demand per stop and destination, to plan routes and fleets with data instead of guesswork. Public
        transport is about 20% of daily trips, and the city aims to reach 50%.
        <Cite n={5} />
      </>
    ),
  },
];

// ---------------------------------------------------------------------------
// Honest inventory: strongest features first, and what is real vs not.
// Numbers come from ml/results/gesture-trials.md and content/models.json only.
// ---------------------------------------------------------------------------

export type Reality = "Real" | "Real, rule-based" | "Estimated" | "Simulated" | "Not built";

export interface RankedFeature {
  feature: string;
  /** How it works, in one line. */
  how: string;
  benefit: string;
  reality: Reality;
}

const REALITY_STYLE: Record<Reality, string> = {
  Real: "border-accent text-accent",
  "Real, rule-based": "border-accent text-accent",
  Estimated: "border-warn text-ink",
  Simulated: "border-muted text-muted",
  "Not built": "border-danger text-danger",
};

/** The status in words, outlined in a matching colour (never colour alone). */
export function RealityBadge({ reality, className = "" }: { reality: Reality; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-pill border-2 px-2.5 font-semibold ${REALITY_STYLE[reality]} ${className}`}
    >
      {reality}
    </span>
  );
}

/** Strongest first: what is most complete and most valuable leads. */
export const STRONGEST_FEATURES: readonly RankedFeature[] = [
  {
    feature: "Live demand → dispatch loop",
    how: "Tickets reach HQ in about 1 s; rules recommend a release; a person approves",
    benefit: "Buses leave for a reason; HQ stays in control",
    reality: "Real",
  },
  {
    feature: "Fair first-come queue",
    how: "Numbered tickets, one per card; the oldest board first, up to free seats",
    benefit: "No pushing and no holding places",
    reality: "Real",
  },
  {
    feature: "Live bus tracking",
    how: "Driver's phone GPS: stop-by-stop progress, arrival within 50 m",
    benefit: "Passengers see where their bus is",
    reality: "Real",
  },
  {
    feature: "Swipe to choose a stop",
    how: "Sensor direction engine, no ML; 85–95% per direction in 20-try tests",
    benefit: "No touchscreen: hygienic and quick",
    reality: "Real, rule-based",
  },
  {
    feature: "On-device voice keywords",
    how: "Edge Impulse model on the Arduino; accuracy not yet measured",
    benefit: "Works offline and keeps voices private",
    reality: "Real",
  },
  {
    feature: "Accounts and roles",
    how: "Five roles; rights enforced in the database",
    benefit: "Each person sees and does only their part",
    reality: "Real",
  },
  {
    feature: "Access for everyone",
    how: "English + Kinyarwanda (draft), spoken numbers, tap fallback, /live",
    benefit: "Works without reading or a smartphone",
    reality: "Real",
  },
  {
    feature: "Seats and why people leave",
    how: "Seats counted from tickets; cancel reasons so far from our tests only",
    benefit: "Shows full buses and why people give up",
    reality: "Estimated",
  },
];

/** What the prototype really does, grouped. Shown on its own slide and on /about. */
export const REALITY: readonly { kind: Reality; items: readonly string[] }[] = [
  {
    kind: "Real",
    items: [
      "Voice keyword model running on the Arduino",
      "Swipe detection by the sensor (rule-based, no ML)",
      "Queue, dispatch rules, dashboard and live updates",
      "Phone GPS tracking and arrival by GPS",
      "Sign-in, roles and the public live board",
    ],
  },
  {
    kind: "Estimated",
    items: [
      "ETA: remaining route distance ÷ an average 18 km/h, no traffic data",
      "Seats on board: counted from tickets, corrected by the driver",
      "Release thresholds (70% load, 15 min): our guesses, not yet tuned",
    ],
  },
  {
    kind: "Simulated",
    items: [
      "Card tap: demo cards on screen",
      "Passengers at other stops: a simulator script",
      "“Simulate drive” for indoor demos, and one-click demo logins",
      "All queue and cancel data so far comes from our own tests",
    ],
  },
  {
    kind: "Not built",
    items: [
      "Real RFID / Tap&Go reader and payment",
      "A trained tap-gesture model",
      "Voice accuracy on new voices and Kinyarwanda accents",
      "Weatherproof LTE + solar kiosk, and a field pilot",
    ],
  },
];

/** Most important first: each fixes a weakness named in REALITY. */
export const IMPROVEMENTS: readonly { what: string; why: string }[] = [
  { what: "Grow the voice model", why: "Test on unseen voices; add speakers and Kinyarwanda accents" },
  { what: "One-week pilot at a real stop", why: "Real waits and noise, to tune the 70% / 15 min rules" },
  { what: "Real card reader", why: "RC522 first, then Tap&Go integration instead of demo cards" },
  { what: "Exact seat counts", why: "Validator taps or door counters instead of ticket counts" },
  { what: "Traffic-aware ETA", why: "Operator GPS (AVL) feeds and live traffic, not a fixed speed" },
  { what: "Street-ready kiosk", why: "Weatherproof case, LTE, solar; native review of the Kinyarwanda" },
];

export const FLOW_STEPS = [
  { n: 1, title: "Tap card", detail: "Tap&Go; simulated reader in the prototype" },
  { n: 2, title: "Say the stop or swipe", detail: "Voice or a swipe over the sensor" },
  { n: 3, title: "Arduino recognises it", detail: "On-device, no internet" },
  { n: 4, title: "Confirm, get a number", detail: "Fair queue ticket, e.g. R3-014" },
  { n: 5, title: "HQ releases the bus", detail: "Kiosk shows the live ETA" },
] as const;

export const WHAT_RUNS_WHERE = [
  { place: "Board", what: "ML, sensors, LED" },
  { place: "Kiosk browser", what: "Gateway over USB" },
  { place: "Cloud", what: "Supabase database, dispatch rules, live updates" },
] as const;

export const ROADMAP_PHASES = [
  { phase: "Prototype", when: "Today", detail: "One kiosk, four destinations, live dashboard" },
  { phase: "Pilot", when: "Next", detail: "2–3 stops on one route" },
  { phase: "City scale", when: "Later", detail: "Every stop a demand sensor" },
] as const;

export const CONCLUSION: readonly { label: string; text: string }[] = [
  {
    label: "Problem",
    text: "Buses and passengers can’t see each other, so waits are long and buses run empty or overcrowded.",
  },
  {
    label: "Solution",
    text: "Tap&Select makes waiting demand visible, so buses leave when and where people are ready.",
  },
  {
    label: "Tech",
    text: "A fair digital queue, live dispatch with a human in the loop, GPS tracking, and on-device voice AI on an Arduino.",
  },
];

export const CLOSING_LINE = "Today, people wait for buses. Tomorrow, buses will know who is waiting.";
