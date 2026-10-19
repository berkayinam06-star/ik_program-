"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  BarChart3,
  ClipboardCheck,
  ChevronRight,
  Activity,
  History,
  Clock4,
  Landmark,
  LogOut,
  UserCog,
  CalendarCheck2,
} from "lucide-react";
import clsx from "clsx";

const adminNavItems = [
  { label: "Panel", href: "/dashboard", icon: LayoutDashboard },
  { label: "Personel", href: "/employees", icon: Users },
  { label: "Gorev Yerleri", href: "/workplaces", icon: Building2 },
  { label: "Sirketler", href: "/companies", icon: Landmark },
  {
    label: "Devam Takibi",
    icon: Activity,
    children: [
      { label: "Gunluk Giris/Cikis", href: "/attendance/daily", icon: CalendarDays },
      { label: "Son Hareketler", href: "/attendance/events", icon: History },
      { label: "Aylik Puantaj", href: "/attendance/monthly", icon: BarChart3 },
      { label: "Vardiya Yonetimi", href: "/shifts", icon: Clock4 },
    ],
  },
  { label: "Donem Onayi", href: "/payroll", icon: ClipboardCheck },
  { label: "Resmi Tatiller", href: "/holidays", icon: CalendarCheck2 },
  { label: "Kullanici Yonetimi", href: "/users", icon: UserCog },
];

const personelNavItems = [
  { label: "Puantaj Ozetim", href: "/my-attendance", icon: BarChart3 },
  { label: "Panel", href: "/dashboard", icon: LayoutDashboard },
];

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string; icon: React.ElementType }[];
};

function NavTree({ items, isActive }: { items: NavItem[]; isActive: (href: string) => boolean }) {
  return (
    <>
      {items.map((item) => {
        if (item.children) {
          const isGroupActive = item.children.some((c) => isActive(c.href));
          return (
            <div key={item.label}>
              <div className={clsx("flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-colors", isGroupActive ? "text-blue-400" : "text-slate-500")}>
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </div>
              <div className="ml-4 pl-3 border-l border-slate-800 space-y-0.5 mt-1">
                {item.children.map((child) => (
                  <Link key={child.href} href={child.href} className={clsx("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 group", isActive(child.href) ? "bg-blue-600/20 text-blue-300 border border-blue-500/30" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800")}>
                    <child.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{child.label}</span>
                    {isActive(child.href) && <ChevronRight className="w-3 h-3 opacity-60" />}
                  </Link>
                ))}
              </div>
            </div>
          );
        }
        return (
          <Link key={item.href} href={item.href!} className={clsx("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group", isActive(item.href!) ? "bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm shadow-blue-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800")}>
            <item.icon className={clsx("w-5 h-5 flex-shrink-0 transition-colors", isActive(item.href!) ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300")} />
            <span className="flex-1">{item.label}</span>
            {isActive(item.href!) && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;
  const isAdmin = user?.role === "admin";
  const navItems = isAdmin ? adminNavItems : personelNavItems;
  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : "?";
  const roleName = isAdmin ? "Yonetici" : "Personel";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <span className="text-white font-black text-sm">IK</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">IK Yonetim</p>
          <p className="text-[10px] text-slate-400 leading-tight">Puantaj Sistemi</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
        <NavTree items={navItems} isActive={isActive} />
      </nav>

      {/* Footer - User info + logout */}
      <div className="px-4 py-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{user?.name ?? "..."}</p>
            <p className="text-[10px] text-slate-500 truncate">{roleName}</p>
          </div>
        </div>
        <button
          id="logout-btn"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          <span>Cikis Yap</span>
        </button>
      </div>
    </aside>
  );
}