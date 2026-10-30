// Every passenger-facing string on the kiosk, in English and Kinyarwanda. Pure.
// Operator-only text (board banners, the debug drawer, the demo card picker) stays English.
//
// KINYARWANDA IS A DRAFT: written without a native speaker. Have a Kinyarwanda speaker
// read every `rw` string before showing it to the public (see README "Kiosk languages").

import { departureLabel, type DepartureStatus } from "./departures";
import { getDestination, gestureHintFor, type DestinationCode } from "./destinations";
import { selectionLabel, type Selection } from "./kiosk-machine";
import type { BoardGestureMode } from "./protocol";
import type { TicketStatus } from "./queue";
import { EN_PROGRESS, type ProgressWords } from "./routes";

export const LANGS = ["en", "rw"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";

export const isLang = (value: unknown): value is Lang => LANGS.includes(value as Lang);

/** Rule-based or model taps rather than swipes (as gestureHintFor). */
const taps = (mode: BoardGestureMode) => mode === "rule" || mode === "model";

export interface KioskText {
  /** The language's own name, shown on the switch. */
  name: string;
  /** For the `lang` attribute. */
  htmlLang: string;

  cancelsIn: string;
  backToStartIn: string;
  keepsPlaceIn: string;
  done: string;
  cancel: string;

  welcome: string;
  tapToBegin: string;
  idleIntro: (mode: BoardGestureMode) => string;
  howToChoose: string;
  columns: { stop: string; say: string; sensor: string };
  say: (name: string) => string;
  holdCardHere: string;
  readingCard: string;

  listening: string;
  listenHeading: (mode: BoardGestureMode) => string;
  tapIfMissed: string;
  sensorSaw: string;
  gestureHint: (code: DestinationCode, mode: BoardGestureMode) => string;
  gestureRecognised: string;

  isThisYourStop: string;
  selection: (s: Selection) => string;
  confirm: string;
  change: string;
  gettingNumber: string;
  numberFailed: string;
  tryAgainOrChange: string;

  hereIsYourNumber: string;
  watchScreen: string;
  alreadyQueued: string;
  oneTicketPerCard: string;
  cancelMyPlace: string;
  queueNumber: string;
  ticketLabel: (code: string, destination: string) => string;
  /** Text before and after the position number. */
  position: [string, string];
  statusHeading: string;
  updatesLive: string;
  ticketStatus: (s: TicketStatus) => string;
  bus: (id: string) => string;

  whyLeaving: string;
  reasonsFailed: string;
  placeKept: string;
  /** A cancel reason; English is the database label. */
  reason: (r: { code: string; label: string }) => string;
  keepMyPlace: string;
  cancelYourPlace: string;
  giveUpPlace: string;
  reasonIs: string;
  startAtBack: string;
  yesCancel: string;
  cancelling: string;
  cancelFailed: string;
  placeCancelled: string;
  thanksForWhy: string;

  nowBoarding: string;
  /** "boarding ticket(s)" between the bus id and the ticket range. */
  boardingTickets: (count: number) => string;
  liveDepartures: string;
  waiting: string;
  departure: (s: DepartureStatus) => string;
  thisStop: string;
  stopsOnRoute: (route: string) => string;
  progress: ProgressWords;

  offlineTitle: string;
  offlineHint: string;
}

const en: KioskText = {
  name: "English",
  htmlLang: "en",

  cancelsIn: "Cancels in",
  backToStartIn: "Back to start in",
  keepsPlaceIn: "Keeps your place in",
  done: "Done",
  cancel: "Cancel",

  welcome: "Welcome",
  tapToBegin: "Tap your card to begin",
  idleIntro: (mode) =>
    `Then say your stop or ${mode === "swipe" ? "swipe over the sensor" : "tap over the sensor"}. You’ll get a queue number and live bus times.`,
  howToChoose: "How to choose your stop",
  columns: { stop: "Stop", say: "Say", sensor: "Or over the sensor" },
  say: (name) => `Say “${name}”`,
  holdCardHere: "Hold your card here",
  readingCard: "Reading card…",

  listening: "Listening",
  listenHeading: (mode) =>
    mode === "off" ? "Say your stop" : mode === "swipe" ? "Say your stop or swipe" : "Say your stop or tap the sensor",
  tapIfMissed: "Tap a stop if I didn’t catch it",
  sensorSaw: "Sensor saw",
  gestureHint: (code, mode) => {
    const d = getDestination(code);
    return d ? gestureHintFor(d, mode) : "";
  },
  gestureRecognised: "Gesture recognised",

  isThisYourStop: "Is this your stop?",
  selection: selectionLabel,
  confirm: "Confirm",
  change: "Change",
  gettingNumber: "Getting your number…",
  numberFailed: "We couldn’t get your number",
  tryAgainOrChange: "Please try again or tap Change.",

  hereIsYourNumber: "Here’s your number",
  watchScreen: "Watch this screen or the board below for your bus.",
  alreadyQueued: "You’re already in the queue",
  oneTicketPerCard: "One ticket per card. Here’s the one you have.",
  cancelMyPlace: "Cancel my place",
  queueNumber: "Queue number",
  ticketLabel: (code, destination) => `Queue number ${code} to ${destination}`,
  position: ["Position ", " in the queue"],
  statusHeading: "Status",
  updatesLive: "Updates live",
  ticketStatus: (s) => s.line,
  bus: (id) => `Bus ${id}`,

  whyLeaving: "Why are you leaving the queue?",
  reasonsFailed: "Can’t load the reasons right now",
  placeKept: "Your place is kept.",
  reason: (r) => r.label,
  keepMyPlace: "Keep my place",
  cancelYourPlace: "Cancel your place?",
  giveUpPlace: "Give up your place?",
  reasonIs: "Reason:",
  startAtBack: "If you queue again, you start at the back.",
  yesCancel: "Yes, cancel my place",
  cancelling: "Cancelling…",
  cancelFailed: "We couldn’t cancel your place",
  placeCancelled: "Your place is cancelled",
  thanksForWhy: "Thank you for telling us why. Tap your card any time to queue again.",

  nowBoarding: "Now boarding",
  boardingTickets: (n) => (n === 1 ? "boarding ticket" : "boarding tickets"),
  liveDepartures: "Live departures",
  waiting: "waiting",
  departure: departureLabel,
  thisStop: "This stop",
  stopsOnRoute: (route) => `Stops on route ${route}`,
  progress: EN_PROGRESS,

  offlineTitle: "Can’t reach Tap&Select right now",
  offlineHint: "You can still tap a stop; numbers will be issued when the connection returns.",
};

// ---- Kinyarwanda (draft, needs a native speaker's review) ----

const RW_GESTURES: Record<DestinationCode, { swipe: string; tap: string }> = {
  REM: { swipe: "Ikiganza ibumoso", tap: "Kanda rimwe" },
  DTN: { swipe: "Ikiganza iburyo", tap: "Kanda kabiri" },
  NYA: { swipe: "Ikiganza hejuru", tap: "Kanda gatatu" },
  KIM: { swipe: "Ikiganza hasi", tap: "Tereka ikiganza, ntukinyeganyeze" },
};

const RW_REASONS: Record<string, string> = {
  waited_too_long: "Nategereje igihe kirekire",
  other_transport: "Nafashe ubundi buryo (moto/tagisi)",
  changed_destination: "Nahinduye aho njya",
  wrong_stop: "Nahisemo sitasiyo itari yo",
  emergency: "Ikibazo cyihutirwa cyangwa impamvu bwite",
  other: "Ibindi",
};

const rwEta = (minutes: number | null) =>
  minutes == null ? "Igihe ntikizwi" : minutes < 1 ? "munsi y’umunota" : `hafi iminota ${minutes}`;

const rw: KioskText = {
  name: "Kinyarwanda",
  htmlLang: "rw",

  cancelsIn: "Birahagarara mu",
  backToStartIn: "Gusubira ku ntangiriro mu",
  keepsPlaceIn: "Umwanya wawe ugumaho mu",
  done: "Soza",
  cancel: "Hagarika",

  welcome: "Murakaza neza",
  tapToBegin: "Kozaho ikarita yawe",
  idleIntro: (mode) =>
    `Hanyuma uvuge aho ugiye cyangwa ${mode === "swipe" ? "unyuze ikiganza hejuru ya sensa" : "ukande hejuru ya sensa"}. Urahabwa nimero ku murongo n’amakuru ya bisi ako kanya.`,
  howToChoose: "Uko wahitamo aho ugiye",
  columns: { stop: "Sitasiyo", say: "Vuga", sensor: "Cyangwa hejuru ya sensa" },
  say: (name) => `Vuga “${name}”`,
  holdCardHere: "Kozaho ikarita yawe hano",
  readingCard: "Turasoma ikarita…",

  listening: "Ndakumva",
  listenHeading: (mode) =>
    mode === "off" ? "Vuga aho ugiye" : mode === "swipe" ? "Vuga aho ugiye cyangwa ukoreshe ikiganza" : "Vuga aho ugiye cyangwa ukande sensa",
  tapIfMissed: "Kanda aho ugiye niba ntakumvise",
  sensorSaw: "Sensa yabonye",
  gestureHint: (code, mode) => (taps(mode) ? RW_GESTURES[code].tap : RW_GESTURES[code].swipe),
  gestureRecognised: "Ikimenyetso cyamenyekanye",

  isThisYourStop: "Ni ho ugiye?",
  selection: ({ method, confidence }) => {
    const pct = confidence === null ? "" : ` · ${Math.round(confidence * 100)}%`;
    return method === "voice" ? `Byumviswe mu ijwi${pct}` : method === "gesture" ? `Ikimenyetso${pct}` : "Wakanze kuri ecran";
  },
  confirm: "Emeza",
  change: "Hindura",
  gettingNumber: "Turimo kugushakira nimero…",
  numberFailed: "Ntitwabashije kubona nimero yawe",
  tryAgainOrChange: "Ongera ugerageze cyangwa ukande Hindura.",

  hereIsYourNumber: "Dore nimero yawe",
  watchScreen: "Reba kuri iyi ecran cyangwa ku kibaho kiri hasi umenye bisi yawe.",
  alreadyQueued: "Usanzwe uri ku murongo",
  oneTicketPerCard: "Itike imwe ku ikarita. Dore iyo ufite.",
  cancelMyPlace: "Reka umwanya wanjye",
  queueNumber: "Nimero ku murongo",
  ticketLabel: (code, destination) => `Nimero ${code} ujya ${destination}`,
  position: ["Uri uwa ", " ku murongo"],
  statusHeading: "Uko bihagaze",
  updatesLive: "Bihinduka ako kanya",
  ticketStatus: (s) => {
    switch (s.kind) {
      case "waiting":
        return "Dutegereje ko bisi yoherezwa";
      case "on_the_way":
        return `Bisi ${s.busId} iri mu nzira · ${rwEta(s.etaMinutes)}`;
      case "called":
        return "Bisi yawe yageze, injira";
      case "not_called":
        return s.known
          ? `Ntiwagiye muri ${s.busId} · ugumana umwanya wawe${s.position ? ` (No. ${s.position})` : ""}`
          : `Bisi ${s.busId} iri kuri sitasiyo`;
      case "done":
        return { completed: "Urugendo rwarangiye", cancelled: "Umwanya wavanweho", invalid: "Itike ntikigikora" }[s.ended];
    }
  },
  bus: (id) => `Bisi ${id}`,

  whyLeaving: "Kuki uvuye ku murongo?",
  reasonsFailed: "Ntidushoboye kubona impamvu ubu",
  placeKept: "Umwanya wawe uracyahari.",
  reason: (r) => RW_REASONS[r.code] ?? r.label,
  keepMyPlace: "Guma ku murongo",
  cancelYourPlace: "Kureka umwanya wawe?",
  giveUpPlace: "Urareka umwanya wawe?",
  reasonIs: "Impamvu:",
  startAtBack: "Nugaruka ku murongo, uzatangirira inyuma.",
  yesCancel: "Yego, reka umwanya wanjye",
  cancelling: "Birimo kuvanwaho…",
  cancelFailed: "Ntitwabashije kuvanaho umwanya wawe",
  placeCancelled: "Umwanya wawe wavanweho",
  thanksForWhy: "Murakoze kutubwira impamvu. Kozaho ikarita igihe cyose ushaka kongera kujya ku murongo.",

  nowBoarding: "Abinjira ubu",
  boardingTickets: (n) => (n === 1 ? "irinjiza itike" : "irinjiza amatike"),
  liveDepartures: "Bisi zigenda ubu",
  waiting: "bategereje",
  departure: (s) =>
    s.kind === "waiting"
      ? "Itaroherezwa"
      : s.kind === "boarding"
        ? "Barinjira"
        : s.etaMinutes == null
          ? `${s.busId} · iri mu nzira`
          : `${s.busId} · imin ${s.etaMinutes}`,
  thisStop: "Hano",
  stopsOnRoute: (route) => `Sitasiyo z’umuhanda ${route}`,
  progress: {
    bus: (id) => `Bisi ${id}`,
    passed: (stop) => `yarenze ${stop}`,
    left: (stop) => `yavuye ${stop}`,
    at: (stop) => `iri ${stop}`,
    stopsAway: (n) => `hasigaye sitasiyo ${n}`,
    eta: rwEta,
  },

  offlineTitle: "Ntidushoboye kugera kuri Tap&Select ubu",
  offlineHint: "Ushobora gukanda aho ugiye; nimero zizatangwa interineti igarutse.",
};

export const KIOSK_TEXT: Readonly<Record<Lang, KioskText>> = { en, rw };
