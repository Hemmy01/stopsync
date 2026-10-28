"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/Button";
import { Wordmark } from "@/components/Wordmark";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <Wordmark />
      <h1 className="mt-10 text-[40px] leading-tight">Something went wrong on this screen.</h1>
      <p className="mt-3 text-lg text-muted">
        The rest of Tap&Select keeps running. Try again, or go back to the start.
      </p>
      <div className="mt-8 flex gap-3">
        <Button variant="ink" size="lg" onClick={retry} icon={<RotateCcw aria-hidden className="h-4 w-4" />}>
          Try again
        </Button>
        <Link
          href="/"
          className="inline-flex h-14 items-center rounded-card border border-line bg-surface px-6 font-semibold hover:border-ink"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
