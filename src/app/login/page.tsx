import LoginForm from "@/components/auth/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Giris Yap | IK Yonetim Sistemi",
  description: "Hesabiniza giris yapin",
};

export default function LoginPage() {
  return <LoginForm />;
}