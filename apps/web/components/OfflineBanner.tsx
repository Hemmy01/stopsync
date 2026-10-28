"use client";

import { useOnline } from "@/lib/use-online";
import { Banner } from "./Banner";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="px-4 pt-4">
      <Banner tone="offline" title="You're offline">
        Live updates are paused. They resume automatically when the connection returns.
      </Banner>
    </div>
  );
}
