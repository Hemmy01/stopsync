import type { Metadata } from "next";
import { BusApp } from "@/components/bus/BusApp";

export const metadata: Metadata = {
  title: "Bus · StopSync",
};

export default function BusPage() {
  return <BusApp />;
}
