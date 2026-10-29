import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = {
  title: "Sign in · Tap&Select",
};

export default function LoginPage() {
  return <LoginScreen />;
}
