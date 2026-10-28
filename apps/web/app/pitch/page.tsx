import type { Metadata } from "next";
import { PitchDeck } from "@/components/pitch/PitchDeck";

export const metadata: Metadata = {
  title: "Pitch · Tap&Select",
  description: "Tap&Select pitch: making passenger demand visible, so buses move when people are ready.",
};

export default function PitchPage() {
  return <PitchDeck />;
}
