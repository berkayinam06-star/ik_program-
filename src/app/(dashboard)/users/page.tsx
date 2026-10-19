import UsersClient from "@/components/users/UsersClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kullanici Yonetimi" };

export default function UsersPage() {
  return <UsersClient />;
}