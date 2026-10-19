import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/auth/Providers";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "İK Yönetim Sistemi",
    template: "%s | İK Yönetim Sistemi",
  },
  description: "İnsan Kaynakları ve Puantaj Yönetim Sistemi — Personel, Görev Yeri ve Devam Takibi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className={`${inter.className} bg-slate-900 text-slate-100 antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
