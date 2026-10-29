import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/RequireRole";
import { BusApp } from "@/components/bus/BusApp";

export const metadata: Metadata = {
  title: "Bus · Tap&Select",
};

export default function BusPage() {
  return (
    <RequireRole page="/bus">
      <BusApp />
    </RequireRole>
  );
}
