// Board adapters. Every adapter delivers raw text lines to the same listener,
// so mock mode and real serial run through exactly the same parsing code.

export type LineListener = (line: string) => void;

export interface BoardAdapter {
  readonly kind: "mock" | "serial";
  /** Subscribe to raw lines from the board. Returns an unsubscribe function. */
  onLine(listener: LineListener): () => void;
  /** Send one line to the board (newline added by the adapter). */
  write(line: string): Promise<void>;
  close(): Promise<void>;
}

/** In-page stand-in for the board, driven by the debug drawer. */
export class MockBoard implements BoardAdapter {
  readonly kind = "mock" as const;
  private listeners = new Set<LineListener>();

  onLine(listener: LineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Pretend the board printed this line. */
  emit(line: string): void {
    for (const listener of this.listeners) listener(line);
  }

  async write(): Promise<void> {
    // Nothing is listening on the other end; outgoing lines appear in the log.
  }

  async close(): Promise<void> {
    this.listeners.clear();
  }
}
