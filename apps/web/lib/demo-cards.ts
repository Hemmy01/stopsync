// Simulated RFID cards for the demo (future: a real RC522 reader).

export interface DemoCard {
  id: string;
  label: string;
}

export const DEMO_CARDS: readonly DemoCard[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `CARD-0${n}`,
  label: `Demo card ${n}`,
}));
