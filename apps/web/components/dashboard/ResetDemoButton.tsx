"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";

interface ResetDemoButtonProps {
  onConfirm: () => void;
  pending: boolean;
}

/** "Reset demo" with a confirm dialog: clears tickets, decisions and events. */
export function ResetDemoButton({ onConfirm, pending }: ResetDemoButtonProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  // Close once the reset finishes.
  useEffect(() => {
    if (!pending) dialog.current?.close();
  }, [pending]);

  return (
    <>
      <Button
        size="lg"
        variant="quiet"
        onClick={() => dialog.current?.showModal()}
        icon={<RotateCcw aria-hidden className="h-4 w-4" />}
      >
        Reset demo
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="reset-title"
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-card border border-line bg-surface p-6 text-ink backdrop:bg-ink/40"
      >
        <h2 id="reset-title" className="text-2xl">
          Reset the demo?
        </h2>
        <p className="mt-2 text-muted">
          This deletes every ticket, recommendation, bus event and model selection, and sends all buses back
          to the terminal. Settings are kept. It can&rsquo;t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button size="lg" onClick={() => dialog.current?.close()} disabled={pending} autoFocus>
            Keep data
          </Button>
          <Button
            size="lg"
            variant="danger"
            onClick={onConfirm}
            pending={pending}
            pendingLabel="Resetting…"
          >
            Reset demo
          </Button>
        </div>
      </dialog>
    </>
  );
}
