"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/Button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} icon={<Printer aria-hidden className="h-4 w-4" />} className="print:hidden">
      Print
    </Button>
  );
}
