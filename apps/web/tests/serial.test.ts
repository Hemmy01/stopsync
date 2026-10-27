import { describe, expect, it, vi } from "vitest";
import { MockBoard, WebSerialBoard } from "@/lib/serial";

/** Minimal stand-in for a Web Serial port, driven from the test. */
function fakePort() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const written: string[] = [];
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let readable: ReadableStream<Uint8Array> | null = null;
  let writable: WritableStream<Uint8Array> | null = null;

  const port = {
    open: vi.fn(async () => {
      readable = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
      writable = new WritableStream<Uint8Array>({ write: (chunk) => void written.push(decoder.decode(chunk)) });
    }),
    close: vi.fn(async () => {
      readable = null;
      writable = null;
    }),
    get readable() {
      return readable;
    },
    get writable() {
      return writable;
    },
  };

  return {
    port: port as unknown as SerialPort,
    open: port.open,
    written,
    feed: (text: string) => controller.enqueue(encoder.encode(text)),
    unplug: () => {
      controller.error(new DOMException("The device has been lost.", "NetworkError"));
      readable = null;
    },
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("WebSerialBoard", () => {
  it("opens at 115200 baud and delivers whole lines from chunked reads", async () => {
    const fake = fakePort();
    const board = new WebSerialBoard(fake.port, () => {});
    const lines: string[] = [];
    board.onLine((l) => lines.push(l));

    await board.open();
    expect(fake.open).toHaveBeenCalledWith({ baudRate: 115200 });

    fake.feed("HELLO,ST");
    fake.feed("OP-01\r\nSTATE,LIS");
    fake.feed("TENING\n");
    await tick();

    expect(lines).toEqual(["HELLO,STOP-01", "STATE,LISTENING"]);
    await board.close();
  });

  it("writes newline-terminated commands", async () => {
    const fake = fakePort();
    const board = new WebSerialBoard(fake.port, () => {});
    await board.open();

    await board.write("START");
    await board.write("ACK,R3-014");

    expect(fake.written).toEqual(["START\n", "ACK,R3-014\n"]);
    await board.close();
  });

  it("reports a lost board when the stream errors (unplugged)", async () => {
    const fake = fakePort();
    const onLost = vi.fn();
    const board = new WebSerialBoard(fake.port, onLost);
    await board.open();

    fake.unplug();
    await tick();

    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it("does not report a lost board after a deliberate close", async () => {
    const fake = fakePort();
    const onLost = vi.fn();
    const board = new WebSerialBoard(fake.port, onLost);
    await board.open();

    await board.close();
    await tick();

    expect(onLost).not.toHaveBeenCalled();
  });
});

describe("MockBoard", () => {
  it("delivers emitted lines to every listener until unsubscribed", () => {
    const mock = new MockBoard();
    const a: string[] = [];
    const b: string[] = [];
    const offA = mock.onLine((l) => a.push(l));
    mock.onLine((l) => b.push(l));

    mock.emit("STATE,LISTENING");
    offA();
    mock.emit("STATE,IDLE");

    expect(a).toEqual(["STATE,LISTENING"]);
    expect(b).toEqual(["STATE,LISTENING", "STATE,IDLE"]);
  });
});
