import { Loader2, Unplug, Usb } from "lucide-react";
import type { SerialConnection } from "@/lib/use-board";

interface ConnectBoardControlProps {
  supported: boolean;
  connection: SerialConnection;
  onConnect: (arduinoOnly: boolean) => void;
  onDisconnect: () => void;
}

const BUTTON =
  "inline-flex h-14 items-center gap-2 rounded-card border border-line bg-surface px-4 text-base font-semibold transition-colors duration-200 ease-out hover:border-ink disabled:cursor-wait disabled:opacity-60";

/** "Connect board" (Arduino ports first, any port on request) or Disconnect. */
export function ConnectBoardControl({ supported, connection, onConnect, onDisconnect }: ConnectBoardControlProps) {
  if (!supported) return null;

  if (connection === "connected") {
    return (
      <button type="button" onClick={onDisconnect} className={BUTTON}>
        <Unplug aria-hidden className="h-5 w-5" />
        Disconnect
      </button>
    );
  }

  const connecting = connection === "connecting";
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onConnect(true)} disabled={connecting} className={BUTTON}>
        {connecting ? (
          <Loader2 aria-hidden className="h-5 w-5 animate-spin" />
        ) : (
          <Usb aria-hidden className="h-5 w-5" />
        )}
        {connecting ? "Connecting…" : connection === "lost" ? "Reconnect board" : "Connect board"}
      </button>
      <button
        type="button"
        onClick={() => onConnect(false)}
        disabled={connecting}
        className="h-14 rounded-card px-3 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
        title="Show every serial port, not only Arduino boards"
      >
        Any port
      </button>
    </div>
  );
}
