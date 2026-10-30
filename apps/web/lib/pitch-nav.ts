// Slide navigation for /pitch. Pure: the deck component owns the DOM.
// Slides are numbered from 1 in the URL hash (/pitch#5) and on screen.

export type PitchSection = "Problem" | "Solution" | "Tech" | "Conclusion";

export const PITCH_SECTIONS: readonly PitchSection[] = ["Problem", "Solution", "Tech", "Conclusion"];

export type DeckAction =
  | { type: "go"; slide: number }
  | { type: "toggle-notes" }
  | { type: "fullscreen" };

/** Clamp a slide number into 1..count. */
export function clampSlide(slide: number, count: number): number {
  if (!Number.isFinite(slide)) return 1;
  return Math.min(Math.max(Math.trunc(slide), 1), count);
}

/** "#5" → 5; anything else → 1. */
export function slideFromHash(hash: string, count: number): number {
  const match = /^#?(\d+)$/.exec(hash.trim());
  return match ? clampSlide(Number(match[1]), count) : 1;
}

/** What a key press means on the presenter, or null to let the browser have it. */
export function actionForKey(key: string, current: number, count: number): DeckAction | null {
  switch (key) {
    case "ArrowRight":
    case "PageDown":
    case " ":
      return { type: "go", slide: clampSlide(current + 1, count) };
    case "ArrowLeft":
    case "PageUp":
      return { type: "go", slide: clampSlide(current - 1, count) };
    case "Home":
      return { type: "go", slide: 1 };
    case "End":
      return { type: "go", slide: count };
    case "n":
    case "N":
      return { type: "toggle-notes" };
    case "f":
    case "F":
      return { type: "fullscreen" };
    default:
      return null;
  }
}

/**
 * Fill (0..1) of each of the four route-coloured progress segments.
 * Slide 1 of n shows 1/n of the bar; the last slide fills it.
 */
export function progressSegments(slide: number, count: number, segments = 4): number[] {
  const progress = count <= 0 ? 0 : clampSlide(slide, count) / count;
  return Array.from({ length: segments }, (_, i) => Math.min(Math.max(progress * segments - i, 0), 1));
}
