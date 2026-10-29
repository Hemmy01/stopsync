import type { Metadata } from "next";
import { LiveBoardApp } from "@/components/live/LiveBoardApp";

export const metadata: Metadata = {
  title: "Live board · Tap&Select",
  description: "Follow Tap&Select live: departures, the queue and buses on the map. Read-only, no sign-in.",
};

export default function LivePage() {
  return <LiveBoardApp />;
}
