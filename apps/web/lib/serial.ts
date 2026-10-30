// Board adapters. Every adapter delivers raw text lines to the same listener,
// so mock mode and real serial run through exactly the same parsing code.

import { ARDUINO_USB_VENDOR_ID, BAUD_RATE, createLineBuffer } from "./protocol";

export type LineListener = (line: string) => void;

const DTR_PULSE_MS = 50;

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

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/**
 * Ask the user to pick a port. With `arduinoOnly`, the chooser is filtered to
 * Arduino's USB vendor id; otherwise every serial port is offered.
 * Resolves null if the user closes the chooser.
 */
export async function requestBoardPort(arduinoOnly: boolean): Promise<SerialPort | null> {
  try {
    return await navigator.serial.requestPort(
      arduinoOnly ? { filters: [{ usbVendorId: ARDUINO_USB_VENDOR_ID }] } : {},
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotFoundError") return null;
    throw err;
  }
}

/** A port this site was already allowed to use (for reconnecting without a prompt). */
export async function findGrantedPort(): Promise<SerialPort | null> {
  if (!isWebSerialSupported()) return null;
  const ports = await navigator.serial.getPorts();
  return (
    ports.find((p) => p.getInfo().usbVendorId === ARDUINO_USB_VENDOR_ID) ?? ports[0] ?? null
  );
}

/** Real board over Web Serial: 115200 baud, newline-delimited text. */
export class WebSerialBoard implements BoardAdapter {
  readonly kind = "serial" as const;
  private listeners = new Set<LineListener>();
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readLoop: Promise<void> | null = null;
  private closing = false;
  private encoder = new TextEncoder();

  /**
   * @param port an opened-or-unopened port
   * @param onLost called once if the board goes away without close()
   */
  constructor(
    readonly port: SerialPort,
    private onLost: (error?: unknown) => void,
  ) {}

  async open(): Promise<void> {
    await this.port.open({ baudRate: BAUD_RATE });
    // Like a serial terminal: DTR high tells the firmware a program is listening,
    // and it answers with HELLO.
    await this.setDtr(true);
    this.readLoop = this.read();
  }

  /** Drop and raise DTR so the firmware sees the port open again and resends HELLO. */
  async requestHello(): Promise<void> {
    await this.setDtr(false);
    await new Promise((resolve) => setTimeout(resolve, DTR_PULSE_MS));
    await this.setDtr(true);
  }

  private async setDtr(on: boolean): Promise<void> {
    try {
      await this.port.setSignals({ dataTerminalReady: on, requestToSend: on });
    } catch {
      // Not supported by this port or already gone: reading still works.
    }
  }

  onLine(listener: LineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async read(): Promise<void> {
    const decoder = new TextDecoder();
    const lines = createLineBuffer();
    let lostError: unknown;

    // readable is replaced after a non-fatal error (e.g. a framing glitch),
    // so keep reading until it is gone, the stream ends, or we are closing.
    let ended = false;
    while (this.port.readable && !this.closing && !ended) {
      const reader = this.port.readable.getReader();
      this.reader = reader;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) {
            ended = true;
            break;
          }
          for (const line of lines.push(decoder.decode(value, { stream: true }))) {
            for (const listener of this.listeners) listener(line);
          }
        }
      } catch (err) {
        lostError = err;
      } finally {
        reader.releaseLock();
        this.reader = null;
      }
    }

    if (!this.closing) this.onLost(lostError);
  }

  async write(line: string): Promise<void> {
    const writable = this.port.writable;
    if (!writable) throw new Error("Board is not writable");
    const writer = writable.getWriter();
    try {
      await writer.write(this.encoder.encode(`${line}\n`));
    } finally {
      writer.releaseLock();
    }
  }

  async close(): Promise<void> {
    this.closing = true;
    this.listeners.clear();
    try {
      await this.reader?.cancel();
      await this.readLoop;
      await this.port.close();
    } catch {
      // Already gone (unplugged): nothing to release.
    }
  }
}
