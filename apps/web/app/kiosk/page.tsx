import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/RequireRole";
import { KioskApp } from "@/components/kiosk/KioskApp";

export const metadata: Metadata = {
  title: "Kiosk · Tap&Select",
};

export default function KioskPage() {
  return (
    <RequireRole page="/kiosk">
      <KioskApp />
    </RequireRole>
  );
}
