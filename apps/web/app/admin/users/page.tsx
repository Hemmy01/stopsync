import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/RequireRole";
import { UsersApp } from "@/components/admin/UsersApp";

export const metadata: Metadata = {
  title: "Users · Tap&Select",
};

export default function UsersPage() {
  return (
    <RequireRole page="/admin/users">
      <UsersApp />
    </RequireRole>
  );
}
