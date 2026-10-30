import type { Metadata } from "next";
import { KioskApp } from "@/components/kiosk/KioskApp";

export const metadata: Metadata = {
  title: "Kiosk · Tap&Select",
};

export default function KioskPage() {
  return <KioskApp />;
}
