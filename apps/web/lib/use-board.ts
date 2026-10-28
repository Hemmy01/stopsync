"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatCommand, parseBoardLine, type BoardMessage, type KioskCommand } from "./protocol";
import { MockBoard } from "./serial";

export type BoardStatus = "connected" | "not_connected" | "mock";

export interface LogEntry {
  id: number;
  at: Date;
  direction: "in" | "out";
  text: string;
  /** Why a line was rejected or ignored. */
  note?: string;
}

/** Return a reason to mark the message as ignored in the log. */
export type MessageHandler = (message: BoardMessage) => string | void;

const MAX_LOG = 200;

export function useBoard({ mockMode, onMessage }: { mockMode: boolean; onMessage: MessageHandler }) {
  const [mock] = useState(() => new MockBoard());
  const [log, setLog] = useState<LogEntry[]>([]);
  const [boardState, setBoardState] = useState<"LISTENING" | "IDLE" | null>(null);
  const [helloStopId, setHelloStopId] = useState<string | null>(null);

  const nextId = useRef(0);
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const append = useCallback((entry: Omit<LogEntry, "id" | "at">) => {
    const full = { ...entry, id: nextId.current++, at: new Date() };
    setLog((prev) => [full, ...prev].slice(0, MAX_LOG));
  }, []);

  // The single entry point for every line from any adapter.
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

  const send = useCallback(
    (command: KioskCommand) => {
      const text = formatCommand(command);
      append({ direction: "out", text, note: mockMode ? undefined : "No board connected" });
      void mock.write();
    },
    [append, mock, mockMode],
  );

  const status: BoardStatus = mockMode ? "mock" : "not_connected";

  return { status, log, boardState, helloStopId, send, mock };
}
