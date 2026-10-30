import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardApp } from "@/components/dashboard/DashboardApp";

export const metadata: Metadata = {
  title: "HQ Dashboard · Tap&Select",
};

export default function DashboardPage() {
  return (
    <RequireRole page="/dashboard">
      <DashboardApp />
    </RequireRole>
  );
}
