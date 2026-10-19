import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "İK Yönetim",
    template: "%s | İK Yönetim",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col md:ml-64 w-full min-w-0 max-w-full">
          <main className="flex-1 min-w-0 max-w-full overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
