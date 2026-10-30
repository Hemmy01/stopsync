import clsx from "clsx";
import type { ReactNode } from "react";
import { INK, Kiosk, MONO, PAPER, Person, R2, SANS, SURFACE } from "./JourneyComic";

// The whole idea in six drawn panels, Sense → Decide → Inform → Next, shown before the live demo.
// Same characters and kiosk as the "How it works" comic; illustrations, not photos of hardware.

type Stage = "Sense" | "Decide" | "Inform" | "Next";

const WARN = "var(--warn)";
const MUTED = "var(--muted)";
const LINE = "var(--line)";

function Ground() {
  return <line x1="6" y1="168" x2="314" y2="168" stroke={LINE} strokeWidth="3" strokeLinecap="round" />;
}

function Pill({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="26" rx="13" fill={SURFACE} stroke={INK} strokeWidth="2.5" />
      <text x={x + w / 2} y={y + 18} textAnchor="middle" fontSize="13" fill={INK} style={MONO}>
        {children}
      </text>
    </g>
  );
}

function Bus({ x, y, doorOpen = false }: { x: number; y: number; doorOpen?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="150" height="66" rx="12" fill={R2} stroke={INK} strokeWidth="3" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={36 + i * 28} y="9" width="20" height="20" rx="3" fill={PAPER} stroke={INK} strokeWidth="2" />
      ))}
      <rect x="8" y="9" width="20" height="44" rx="3" fill={doorOpen ? INK : PAPER} stroke={INK} strokeWidth="2" />
      <rect x="112" y="38" width="30" height="18" rx="4" fill={SURFACE} stroke={INK} strokeWidth="2" />
      <text x="127" y="51" textAnchor="middle" fontSize="11" fill={INK} style={{ ...MONO, fontWeight: 700 }}>
        R2
      </text>
      <circle cx="34" cy="68" r="11" fill={INK} />
      <circle cx="118" cy="68" r="11" fill={INK} />
      <circle cx="34" cy="68" r="4" fill={PAPER} />
      <circle cx="118" cy="68" r="4" fill={PAPER} />
    </g>
  );
}

/** 1 Sense: a short line at the stop; every passenger is counted per destination. */
function QueueAtStop() {
  return (
    <svg viewBox="0 0 320 180" role="img" aria-label="Three passengers queue at a kiosk; HQ counts 12 waiting for Remera">
      <Ground />
      <g transform="translate(0 -4) scale(0.9)">
        <g transform="translate(120 0)">
          <Kiosk screen={<text x="172" y="65" textAnchor="middle" fontSize="10" fill={INK} style={SANS}>Tap card</text>} />
        </g>
        <Person x={70} hand={[86, 130]} />
        <Person x={140} hand={[156, 130]} />
        <Person x={212} hand={[270, 128]}>
          <rect x="262" y="114" width="16" height="24" rx="3" fill={SURFACE} stroke={INK} strokeWidth="2" transform="rotate(-12 270 126)" />
        </Person>
      </g>
      <g>
        <rect x="10" y="8" width="168" height="28" rx="14" fill={SURFACE} stroke={INK} strokeWidth="2.5" />
        <rect x="16" y="13" width="26" height="18" rx="4" fill={R2} />
        <text x="29" y="26" textAnchor="middle" fontSize="11" fill={SURFACE} style={{ ...MONO, fontWeight: 700 }}>R2</text>
        <text x="110" y="27" textAnchor="middle" fontSize="13" fill={INK} style={MONO}>12 waiting</text>
      </g>
    </svg>
  );
}

/** 2 Decide: HQ sees demand per route; the rule flags R2 at 72%. */
function HqSeesDemand() {
  const bars = [
    { route: "R1", color: "var(--route-1)", pct: 0.2 },
    { route: "R2", color: R2, pct: 0.72 },
    { route: "R3", color: "var(--route-3)", pct: 0.35 },
    { route: "R4", color: "var(--route-4)", pct: 0.12 },
  ];
  return (
    <svg viewBox="0 0 320 180" role="img" aria-label="An HQ dispatcher sees demand per route; R2 is at 72% and a release is recommended">
      <Ground />
      <rect x="118" y="8" width="192" height="128" rx="8" fill={SURFACE} stroke={INK} strokeWidth="3" />
      <rect x="204" y="136" width="20" height="20" fill={INK} />
      <rect x="180" y="154" width="68" height="8" rx="3" fill={INK} />
      {bars.map((b, i) => (
        <g key={b.route} transform={`translate(128 ${18 + i * 20})`}>
          <rect x="0" y="0" width="24" height="14" rx="3" fill={b.color} />
          <text x="12" y="11" textAnchor="middle" fontSize="9" fill={SURFACE} style={{ ...MONO, fontWeight: 700 }}>{b.route}</text>
          <rect x="30" y="3" width="110" height="8" rx="4" fill={PAPER} />
          <rect x="30" y="3" width={110 * b.pct} height="8" rx="4" fill={b.pct >= 0.7 ? WARN : MUTED} />
          {b.pct >= 0.7 ? <text x="146" y="11" fontSize="10" fill={INK} style={{ ...MONO, fontWeight: 700 }}>72%</text> : null}
        </g>
      ))}
      <rect x="132" y="102" width="164" height="24" rx="12" fill={PAPER} stroke={WARN} strokeWidth="2.5" />
      <text x="214" y="118" textAnchor="middle" fontSize="11" fill={INK} style={SANS}>Release a bus to Remera?</text>
      <g transform="translate(0 -12) scale(0.92)">
        <Person x={62} hand={[124, 104]} />
      </g>
    </svg>
  );
}

/** 3 Decide: a person approves; the bus leaves and the driver's phone shares GPS. */
function BusReleased() {
  return (
    <svg viewBox="0 0 320 180" role="img" aria-label="HQ approves; bus R2-01 leaves the terminal while the driver's phone shares its location">
      <Ground />
      <path d="M8 96 L48 70 L88 96 Z" fill={PAPER} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="14" y="96" width="68" height="72" fill={SURFACE} stroke={INK} strokeWidth="2.5" />
      <text x="48" y="124" textAnchor="middle" fontSize="11" fill={INK} style={SANS}>Terminal</text>
      <rect x="36" y="138" width="24" height="30" fill={PAPER} stroke={INK} strokeWidth="2" />
      <g className="motion-safe:animate-[comic-drive_2.4s_ease-out_infinite]">
        <path d="M100 116 h22 M94 130 h28 M102 144 h20" stroke={MUTED} strokeWidth="3" strokeLinecap="round" />
        <Bus x={140} y={88} />
        <rect x="246" y="42" width="24" height="40" rx="5" fill={INK} />
        <rect x="249" y="47" width="18" height="28" rx="2" fill={PAPER} />
        <circle cx="258" cy="61" r="4" fill={R2} />
        <path d="M276 50 a12 12 0 0 1 0 22 M283 44 a20 20 0 0 1 0 34" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g>
        <rect x="8" y="10" width="150" height="28" rx="14" fill="var(--accent)" />
        <path d="M22 24 l6 6 l11 -12" fill="none" stroke={SURFACE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text x="96" y="29" textAnchor="middle" fontSize="13" fill={SURFACE} style={SANS}>Approved by HQ</text>
      </g>
    </svg>
  );
}

/** 4 Inform: the kiosk shows and speaks the ETA; anyone can follow it on /live. */
function EveryoneSeesEta() {
  return (
    <svg viewBox="0 0 320 180" role="img" aria-label="The kiosk shows and reads out the ETA, and a passenger follows the bus on the live board on a phone">
      <Ground />
      <g transform="translate(-118 -14) scale(1 1)">
        <Kiosk
          screen={
            <g>
              <text x="172" y="58" textAnchor="middle" fontSize="9" fill={MUTED} style={SANS}>R2-014</text>
              <text x="172" y="72" textAnchor="middle" fontSize="12" fill={INK} style={{ ...MONO, fontWeight: 700 }}>6 min</text>
            </g>
          }
        />
      </g>
      <path d="M96 52 a10 10 0 0 1 0 16 M104 46 a18 18 0 0 1 0 28" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <g transform="translate(0 -2) scale(0.92)">
        <Person x={250} hand={[226, 100]}>
          <rect x="196" y="70" width="34" height="56" rx="5" fill={INK} />
          <rect x="200" y="76" width="26" height="44" rx="2" fill={PAPER} />
          <path d="M204 112 C210 100 216 96 222 82" fill="none" stroke={R2} strokeWidth="3" strokeLinecap="round" />
          <circle cx="215" cy="96" r="4" fill={INK} />
        </Person>
      </g>
      <Pill x={120} y={8} w={80}>
        /live
      </Pill>
    </svg>
  );
}

/** 5 Inform: the bus arrives and the line boards in ticket order. */
function BoardInOrder() {
  const tickets = ["012", "013", "014"];
  return (
    <svg viewBox="0 0 320 180" role="img" aria-label="The bus arrives and passengers with tickets R2-012 to R2-014 board in order">
      <Ground />
      <Bus x={164} y={90} doorOpen />
      <g transform="translate(0 -14) scale(0.9)">
        {tickets.map((t, i) => (
          <Person key={t} x={40 + i * 56} hand={[56 + i * 56, 130]} />
        ))}
      </g>
      {tickets.map((t, i) => (
        <g key={t}>
          <rect x={18 + i * 50} y="12" width="42" height="22" rx="11" fill={SURFACE} stroke={INK} strokeWidth="2" />
          <text x={39 + i * 50} y="27" textAnchor="middle" fontSize="12" fill={INK} style={{ ...MONO, fontWeight: 700 }}>{t}</text>
        </g>
      ))}
      <path d="M166 22 h30 m-8 -7 l8 7 l-8 7" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Pill x={206} y={10} w={106}>
        Boarding
      </Pill>
    </svg>
  );
}

/** 6 Next: many kiosks across Kigali feeding one picture of demand. */
function CityNetwork() {
  const routes = [
    { color: "var(--route-1)", d: "M160 96 C120 90 70 70 18 40" },
    { color: R2, d: "M160 96 C200 80 250 60 304 36" },
    { color: "var(--route-3)", d: "M160 96 C210 110 260 130 304 156" },
    { color: "var(--route-4)", d: "M160 96 C120 120 70 140 18 160" },
  ];
  const kiosks: [number, number][] = [
    [54, 60], [96, 80], [214, 74], [262, 52], [212, 116], [262, 140], [104, 128], [56, 148],
  ];
  return (
    <svg viewBox="0 0 320 180" role="img" aria-label="A map of Kigali with kiosks along four routes, all feeding one HQ">
      {routes.map((r) => (
        <path key={r.color} d={r.d} fill="none" stroke={r.color} strokeWidth="6" strokeLinecap="round" />
      ))}
      {kiosks.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x - 7} y={y - 9} width="14" height="18" rx="3" fill={SURFACE} stroke={INK} strokeWidth="2.5" />
          <circle cx={x} cy={y - 2} r="2" fill={INK} />
        </g>
      ))}
      <circle cx="160" cy="96" r="20" fill={INK} />
      <text x="160" y="101" textAnchor="middle" fontSize="13" fill={SURFACE} style={SANS}>HQ</text>
      <circle cx="160" cy="96" r="20" fill="none" stroke={INK} strokeWidth="2" opacity="0.4" className="motion-safe:animate-[comic-glow_2s_ease-out_infinite]" />
      <text x="160" y="22" textAnchor="middle" fontSize="12" fill={MUTED} style={SANS}>Concept · not built yet</text>
    </svg>
  );
}

const STORY: { stage: Stage; title: string; detail: string; Drawing: () => ReactNode }[] = [
  {
    stage: "Sense",
    title: "Passengers join a digital queue",
    detail: "Tap a card, say or swipe the stop. HQ counts who waits, per destination.",
    Drawing: QueueAtStop,
  },
  {
    stage: "Decide",
    title: "HQ sees demand live",
    detail: "Rules suggest a release at 70% load or a 15-minute wait.",
    Drawing: HqSeesDemand,
  },
  {
    stage: "Decide",
    title: "A person approves; the bus leaves",
    detail: "The driver's phone shares GPS for that bus.",
    Drawing: BusReleased,
  },
  {
    stage: "Inform",
    title: "Everyone sees the ETA",
    detail: "On the kiosk, read out loud, and on /live from any phone.",
    Drawing: EveryoneSeesEta,
  },
  {
    stage: "Inform",
    title: "Board in ticket order",
    detail: "The bus arrives; tickets are called in order and marked boarded.",
    Drawing: BoardInOrder,
  },
  {
    stage: "Next",
    title: "Every stop becomes a sensor",
    detail: "A pilot on one route, then the network: one picture of demand for the city.",
    Drawing: CityNetwork,
  },
];

/** Sense → Decide → Inform → Next, as a 3 × 2 storyboard. */
export function IdeaStoryboard({ size = "slide" }: { size?: "slide" | "page" }) {
  const slide = size === "slide";
  return (
    <ol className={clsx("grid gap-3", slide ? "grid-cols-3" : "sm:grid-cols-3")}>
      {STORY.map(({ stage, title, detail, Drawing }, i) => (
        <li key={title} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
          <div className={clsx("border-b border-line bg-paper", slide && "[&>svg]:h-[136px] [&>svg]:w-full")}>
            <Drawing />
          </div>
          <div className={slide ? "px-4 py-2" : "p-3"}>
            <p
              className={clsx(
                "font-semibold uppercase tracking-[0.12em]",
                slide ? "text-[12px]" : "text-xs",
                stage === "Next" ? "text-muted" : "text-ink",
              )}
            >
              <span className="num">{i + 1}</span> · {stage === "Next" ? "Next (not built yet)" : stage}
            </p>
            <h3 className={slide ? "text-[19px] leading-tight" : "text-base leading-tight"}>{title}</h3>
            <p className={clsx("text-muted", slide ? "text-[15px] leading-snug" : "mt-1 text-sm")}>{detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
