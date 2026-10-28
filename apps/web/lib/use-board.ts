"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatCommand, parseBoardLine, type BoardMessage, type KioskCommand } from "./protocol";
import { findGrantedPort, isWebSerialSupported, MockBoard, requestBoardPort, WebSerialBoard } from "./serial";

export type BoardStatus = "connected" | "not_connected" | "mock";

/** idle: never connected · lost: was connected, then unplugged or failed. */
export type SerialConnection = "idle" | "connecting" | "connected" | "lost";

export interface LogEntry {
  id: number;
  at: Date;
  direction: "in" | "out" | "sys";
  text: string;
  /** Why a line was rejected or ignored, or a send problem. */
  note?: string;
}

/** Return a reason to mark the message as ignored in the log. */
export type MessageHandler = (message: BoardMessage) => string | void;

const MAX_LOG = 200;
const AUTO_RETRY_MS = 600;

const noopSubscribe = () => () => {};

function openErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "InvalidStateError" || name === "NetworkError") {
    return "Couldn't open the board. Close the Arduino Serial Monitor or any other tab using it, then try again.";
  }
  if (name === "SecurityError") return "The browser blocked access to the board.";
  return err instanceof Error ? err.message : "Couldn't open the board.";
}

export function useBoard({ mockMode, onMessage }: { mockMode: boolean; onMessage: MessageHandler }) {
  const [mock] = useState(() => new MockBoard());
  const [log, setLog] = useState<LogEntry[]>([]);
  const [boardState, setBoardState] = useState<"LISTENING" | "IDLE" | null>(null);
  const [helloStopId, setHelloStopId] = useState<string | null>(null);
  const [connection, setConnection] = useState<SerialConnection>("idle");
  const [serialError, setSerialError] = useState<string | null>(null);

  const serialSupported = useSyncExternalStore(noopSubscribe, isWebSerialSupported, () => false);

  const nextId = useRef(0);
  const serialRef = useRef<WebSerialBoard | null>(null);
  const attaching = useRef(false);
  const wasConnected = useRef(false);
  const mounted = useRef(false);

  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const append = useCallback((entry: Omit<LogEntry, "id" | "at">) => {
    const full = { ...entry, id: nextId.current++, at: new Date() };
    setLog((prev) => [full, ...prev].slice(0, MAX_LOG));
  }, []);

  // The single entry point for every line from any adapter, mock or serial.
  const handleLine = useCallback(
    (raw: string) => {
      const text = raw.trim();
      const result = parseBoardLine(text);
      if (!result.ok) {
        append({ direction: "in", text, note: `Ignored: ${result.reason}` });
        return;
      }
      const { message } = result;
      if (message.type === "HELLO") setHelloStopId(message.stopId);
      if (message.type === "STATE") setBoardState(message.state);
      const ignored = onMessageRef.current(message);
      append({ direction: "in", text, note: ignored ? `Ignored: ${ignored}` : undefined });
    },
    [append],
  );

  useEffect(() => mock.onLine(handleLine), [mock, handleLine]);

  const handleLost = useCallback(
    (adapter: WebSerialBoard) => {
      if (serialRef.current !== adapter) return;
      serialRef.current = null;
      void adapter.close();
      setConnection("lost");
      setBoardState(null);
      append({ direction: "sys", text: "Board disconnected" });
    },
    [append],
  );

  /** Open a port and start reading. Returns false if it could not be opened. */
  const attach = useCallback(
    async (port: SerialPort, { silent = false } = {}): Promise<boolean> => {
      if (serialRef.current || attaching.current) return true;
      attaching.current = true;
      setConnection("connecting");
      setSerialError(null);

      const adapter: WebSerialBoard = new WebSerialBoard(port, () => handleLost(adapter));
      try {
        await adapter.open();
      } catch (err) {
        attaching.current = false;
        setConnection(wasConnected.current ? "lost" : "idle");
        if (!silent) setSerialError(openErrorMessage(err));
        return false;
      }
      attaching.current = false;

      if (!mounted.current) {
        await adapter.close();
        return false;
      }

      adapter.onLine(handleLine);
      serialRef.current = adapter;
      wasConnected.current = true;
      setConnection("connected");
      append({ direction: "sys", text: "Connected to board" });
      return true;
    },
    [append, handleLine, handleLost],
  );

  /** "Connect board": open the browser's port chooser. */
  const connect = useCallback(
    async (arduinoOnly = true) => {
      if (!isWebSerialSupported()) return;
      try {
        const port = await requestBoardPort(arduinoOnly);
        if (port) await attach(port);
      } catch (err) {
        setSerialError(openErrorMessage(err));
      }
    },
    [attach],
  );

  const disconnect = useCallback(async () => {
    const adapter = serialRef.current;
    if (!adapter) return;
    serialRef.current = null;
    wasConnected.current = false;
    await adapter.close();
    setConnection("idle");
    setBoardState(null);
    append({ direction: "sys", text: "Disconnected from board" });
  }, [append]);

  // Reconnect without a prompt to a port this site was already allowed to use:
  // on load, and whenever an allowed board is plugged back in.
  useEffect(() => {
    mounted.current = true;
    if (!isWebSerialSupported()) {
      return () => {
        mounted.current = false;
      };
    }

    let retry: ReturnType<typeof setTimeout> | undefined;
    const autoAttach = async (port: SerialPort | null) => {
      if (!port || !mounted.current) return;
      const ok = await attach(port, { silent: true });
      // The port can still be closing from a previous page; try once more.
      if (!ok && mounted.current) retry = setTimeout(() => void attach(port, { silent: true }), AUTO_RETRY_MS);
    };

    void findGrantedPort().then(autoAttach);

    const onConnect = (e: Event) => {
      if (e.target instanceof SerialPort) void autoAttach(e.target);
    };
    const onDisconnect = (e: Event) => {
      const adapter = serialRef.current;
      if (adapter && e.target === adapter.port) handleLost(adapter);
    };
    navigator.serial.addEventListener("connect", onConnect);
    navigator.serial.addEventListener("disconnect", onDisconnect);

    return () => {
      mounted.current = false;
      clearTimeout(retry);
      navigator.serial.removeEventListener("connect", onConnect);
      navigator.serial.removeEventListener("disconnect", onDisconnect);
      const adapter = serialRef.current;
      serialRef.current = null;
      void adapter?.close();
    };
  }, [attach, handleLost]);

  const send = useCallback(
    (command: KioskCommand) => {
      const text = formatCommand(command);
      const serial = serialRef.current;
      if (serial) {
        append({ direction: "out", text });
        serial.write(text).catch((err: unknown) => {
          append({
            direction: "sys",
            text: `Could not send ${text}`,
            note: err instanceof Error ? err.message : undefined,
          });
        });
        return;
      }
      append({ direction: "out", text, note: mockMode ? undefined : "No board connected" });
      void mock.write();
    },
    [append, mock, mockMode],
  );

  const status: BoardStatus = connection === "connected" ? "connected" : mockMode ? "mock" : "not_connected";

  return {
    status,
    connection,
    serialSupported,
    serialError,
    log,
    boardState,
    helloStopId,
    send,
    connect,
    disconnect,
    mock,
  };
}
