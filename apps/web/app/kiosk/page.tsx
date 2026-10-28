import type { Metadata } from "next";
import { KioskApp } from "@/components/kiosk/KioskApp";

export const metadata: Metadata = {
  title: "Kiosk · StopSync",
};

export default function KioskPage() {
  return <KioskApp />;
}
