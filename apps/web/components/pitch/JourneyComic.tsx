import clsx from "clsx";
import type { ReactNode } from "react";
import { FLOW_STEPS } from "./content";

// A five-panel comic of one passenger's journey, drawn in the signage style (ink outlines,
// paper, route colours only where they mean a route). Illustrations, not photos of hardware.

export const INK = "var(--ink)";
export const PAPER = "var(--paper)";
export const SURFACE = "var(--surface)";
export const R2 = "var(--route-2)";
export const SKIN = "#8a5a3c";
const SHIRT = "var(--muted)";
export const MONO = { fontFamily: "var(--font-mono)" } as const;
export const SANS = { fontFamily: "var(--font-sans)", fontWeight: 700 } as const;

export function Ground() {
  return <line x1="8" y1="186" x2="232" y2="186" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />;
}

/** A commuter standing at x, reaching toward `hand`. */
export function Person({ x, hand, children }: { x: number; hand: [number, number]; children?: ReactNode }) {
  const [hx, hy] = hand;
  return (
    <g>
      <line x1={x - 8} y1="138" x2={x - 10} y2="184" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <line x1={x + 8} y1="138" x2={x + 10} y2="184" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <path d={`M${x - 20} 142 V100 a20 20 0 0 1 40 0 V142 Z`} fill={SHIRT} stroke={INK} strokeWidth="3" />
      <path d={`M${x + 12} 96 L${hx} ${hy}`} stroke={SHIRT} strokeWidth="9" strokeLinecap="round" />
      <circle cx={hx} cy={hy} r="6" fill={SKIN} stroke={INK} strokeWidth="2" />
      {children}
      <circle cx={x} cy="60" r="17" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d={`M${x - 16} 55 a16 14 0 0 1 32 0 a20 6 0 0 0 -32 0`} fill={INK} />
      <circle cx={x + 7} cy="62" r="2" fill={INK} />
    </g>
  );
}

/** The stop kiosk: small screen, the sensor window you swipe over, the card pad. */
export function Kiosk({ screen }: { screen: ReactNode }) {
  return (
    <g>
      <rect x="165" y="150" width="14" height="36" fill={INK} />
      <rect x="138" y="34" width="68" height="120" rx="10" fill={SURFACE} stroke={INK} strokeWidth="3" />
      <rect x="146" y="42" width="52" height="36" rx="4" fill={PAPER} stroke={INK} strokeWidth="2" />
      {screen}
      <circle cx="172" cy="94" r="7" fill={INK} />
      <circle cx="170" cy="92" r="2" fill={SURFACE} />
      <rect x="154" y="112" width="36" height="30" rx="5" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M166 121 a8 8 0 0 1 0 12 M171 118 a12 12 0 0 1 0 18" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function TapCard() {
  return (
    <svg viewBox="0 0 240 200" role="img" aria-label="A passenger taps a card on the kiosk's card pad">
      <Ground />
      <Kiosk screen={<text x="172" y="65" textAnchor="middle" fontSize="10" fill={INK} style={SANS}>Tap card</text>} />
      <Person x={78} hand={[150, 128]}>
        <rect x="140" y="114" width="16" height="24" rx="3" fill={SURFACE} stroke={INK} strokeWidth="2" transform="rotate(-12 148 126)" />
      </Person>
      <path d="M198 116 l10 -6 M200 127 h12 M198 138 l10 6" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function SwipeOrSay() {
  return (
    <svg viewBox="0 0 240 200" role="img" aria-label="The passenger swipes left over the sensor or says Remera">
      <Ground />
      <Kiosk
        screen={
          <g>
            {["var(--route-2)", "var(--route-4)", "var(--route-1)", "var(--route-3)"].map((c, i) => (
              <rect key={c} x={150 + (i % 2) * 24} y={46 + Math.floor(i / 2) * 15} width="20" height="12" rx="2" fill={c} />
            ))}
          </g>
        }
      />
      <Person x={70} hand={[142, 84]} />
      <g className="motion-safe:animate-[comic-swipe_1.6s_ease-out_infinite]">
        <path d="M150 70 h-34 m10 -8 l-10 8 l10 8" fill="none" stroke={R2} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g>
        <path d="M52 6 h74 a8 8 0 0 1 8 8 v18 a8 8 0 0 1 -8 8 h-34 l-12 10 v-10 h-28 a8 8 0 0 1 -8 -8 v-18 a8 8 0 0 1 8 -8 Z" fill={SURFACE} stroke={INK} strokeWidth="2.5" />
        <text x="90" y="28" textAnchor="middle" fontSize="15" fill={INK} style={SANS}>Remera!</text>
      </g>
    </svg>
  );
}

function BoardRecognises() {
  return (
    <svg viewBox="0 0 240 200" role="img" aria-label="The Arduino board recognises Remera and sends SELECT,REM to the kiosk">
      <rect x="24" y="96" width="192" height="56" rx="6" fill={INK} />
      <rect x="10" y="112" width="18" height="24" rx="2" fill="var(--muted)" />
      {Array.from({ length: 15 }, (_, i) => (
        <g key={i}>
          <rect x={36 + i * 12} y="99" width="5" height="5" fill="#c9a227" />
          <rect x={36 + i * 12} y="144" width="5" height="5" fill="#c9a227" />
        </g>
      ))}
      <rect x="92" y="110" width="36" height="28" rx="2" fill="#2a2f36" stroke="#4b525c" />
      <circle cx="160" cy="118" r="7" fill="#4b525c" />
      <rect x="182" y="114" width="16" height="10" rx="2" fill="#4b525c" />
      <g className="motion-safe:animate-[comic-glow_1.6s_ease-out_infinite]">
        <circle cx="62" cy="124" r="14" fill={R2} opacity="0.25" />
      </g>
      <circle cx="62" cy="124" r="7" fill={R2} stroke={SURFACE} strokeWidth="2" />
      <text x="120" y="172" textAnchor="middle" fontSize="11" fill="var(--muted)" style={SANS}>mic · sensor · model, all on the board</text>
      <rect x="40" y="26" width="160" height="40" rx="8" fill={SURFACE} stroke={INK} strokeWidth="2.5" />
      <text x="120" y="51" textAnchor="middle" fontSize="15" fill={INK} style={MONO}>SELECT,REM</text>
      <path d="M120 66 v22 m-7 -8 l7 8 l7 -8" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180 120 77)" />
    </svg>
  );
}

function ConfirmTicket() {
  return (
    <svg viewBox="0 0 240 200" role="img" aria-label="The screen asks Remera?; the passenger taps Confirm and gets ticket R2-014">
      <rect x="14" y="28" width="122" height="120" rx="10" fill={SURFACE} stroke={INK} strokeWidth="3" />
      <text x="75" y="64" textAnchor="middle" fontSize="18" fill={INK} style={SANS}>Remera?</text>
      <rect x="30" y="80" width="90" height="30" rx="15" fill="var(--accent)" />
      <text x="75" y="100" textAnchor="middle" fontSize="12" fill={SURFACE} style={SANS}>Confirm</text>
      <rect x="30" y="116" width="90" height="22" rx="11" fill="none" stroke="var(--line)" strokeWidth="2" />
      <text x="75" y="131" textAnchor="middle" fontSize="10" fill="var(--muted)" style={SANS}>Change</text>
      <path d="M86 186 L94 112 a6 6 0 0 1 12 1 L104 150 L122 156 a8 8 0 0 1 6 9 L124 186" fill={SKIN} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <g transform="rotate(-6 186 96)">
        <rect x="144" y="54" width="84" height="88" rx="8" fill={SURFACE} stroke={INK} strokeWidth="2.5" />
        <rect x="144" y="54" width="12" height="88" rx="4" fill={R2} />
        <circle cx="228" cy="98" r="6" fill={PAPER} />
        <text x="162" y="76" fontSize="9" fill="var(--muted)" style={SANS}>Remera</text>
        <text x="162" y="102" fontSize="17" fill={INK} style={{ ...MONO, fontWeight: 700 }}>R2-014</text>
        <text x="162" y="124" fontSize="9" fill="var(--muted)" style={SANS}>3rd in line</text>
      </g>
    </svg>
  );
}

function BusOnTheWay() {
  return (
    <svg viewBox="0 0 240 200" role="img" aria-label="Bus R2 is on the way to the stop, about 6 minutes">
      <Ground />
      <line x1="210" y1="76" x2="210" y2="186" stroke={INK} strokeWidth="4" />
      <rect x="194" y="56" width="32" height="24" rx="4" fill={SURFACE} stroke={INK} strokeWidth="2.5" />
      <text x="210" y="73" textAnchor="middle" fontSize="11" fill={INK} style={SANS}>Stop</text>
      <g className="motion-safe:animate-[comic-drive_2.4s_ease-out_infinite]">
        <rect x="18" y="96" width="150" height="74" rx="12" fill={R2} stroke={INK} strokeWidth="3" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={30 + i * 32} y="106" width="24" height="24" rx="3" fill={PAPER} stroke={INK} strokeWidth="2" />
        ))}
        <rect x="26" y="140" width="34" height="22" rx="4" fill={SURFACE} stroke={INK} strokeWidth="2" />
        <text x="43" y="156" textAnchor="middle" fontSize="13" fill={INK} style={{ ...MONO, fontWeight: 700 }}>R2</text>
        <circle cx="52" cy="174" r="12" fill={INK} />
        <circle cx="136" cy="174" r="12" fill={INK} />
        <circle cx="52" cy="174" r="4" fill={PAPER} />
        <circle cx="136" cy="174" r="4" fill={PAPER} />
      </g>
      <rect x="40" y="28" width="132" height="34" rx="17" fill={SURFACE} stroke={INK} strokeWidth="2.5" />
      <text x="106" y="50" textAnchor="middle" fontSize="13" fill={INK} style={MONO}>about 6 min</text>
    </svg>
  );
}

const PANELS = [TapCard, SwipeOrSay, BoardRecognises, ConfirmTicket, BusOnTheWay];

/** The five steps as comic panels with the FLOW_STEPS captions. */
export function JourneyComic({ size = "slide" }: { size?: "slide" | "page" }) {
  const slide = size === "slide";
  return (
    <ol className={clsx("grid gap-3", slide ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-5")}>
      {FLOW_STEPS.map((s, i) => {
        const Drawing = PANELS[i];
        return (
          <li key={s.n} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
            <div className="relative border-b border-line bg-paper">
              <span
                className={clsx(
                  "num absolute top-2 left-2 flex items-center justify-center rounded-full bg-ink font-bold text-paper",
                  slide ? "h-9 w-9 text-[18px]" : "h-7 w-7 text-sm",
                )}
              >
                {s.n}
              </span>
              <Drawing />
            </div>
            <div className={slide ? "p-4" : "p-3"}>
              <h3 className={slide ? "text-[22px] leading-tight" : "text-base leading-tight"}>{s.title}</h3>
              <p className={clsx("mt-1 text-muted", slide ? "text-[17px] leading-snug" : "text-sm")}>{s.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
