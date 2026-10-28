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

export const FEATURES_TO_BENEFITS: readonly [string, string][] = [
  [
    "On-device voice AI (Arduino Nano 33 BLE Sense)",
    "Works offline, fast, and no audio ever leaves the board (privacy)",
  ],
  ["Tap gestures over a sensor", "No touchscreen, so it’s hygienic and accessible"],
  ["Confirm step plus tap-a-tile fallback", "A wrong guess never blocks a passenger"],
  ["Dispatch rules with a human approving", "Operators stay in control"],
  ["One waiting ticket per card", "No holding places for absent friends"],
  ["Real-time dashboard and GPS ETA", "Everyone sees the same live picture"],
];

export const FLOW_STEPS = [
  { n: 1, title: "Tap card", detail: "Tap&Go; simulated reader in the prototype" },
  { n: 2, title: "Say the stop or tap a gesture", detail: "Voice or taps over the sensor" },
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

export const UPGRADES = [
  "RC522 reader with real Tap&Go integration",
  "Trained gesture model",
  "More voices and Kinyarwanda accents",
  "LTE kiosk with solar power",
  "Operator GPS feeds",
  "Camera module for hand-sign selection",
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
    text: "On-device voice AI on an Arduino, a fair digital queue, and a live dispatch dashboard.",
  },
];

export const CLOSING_LINE = "Today, people wait for buses. Tomorrow, buses will know who is waiting.";
