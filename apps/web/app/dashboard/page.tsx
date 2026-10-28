import type { Metadata } from "next";
import { DashboardApp } from "@/components/dashboard/DashboardApp";

export const metadata: Metadata = {
  title: "HQ Dashboard · Tap&Select",
};

export default function DashboardPage() {
  return <DashboardApp />;
}
