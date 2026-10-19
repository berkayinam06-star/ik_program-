"use client";

import { Bell, Search, Menu } from "lucide-react";
import { useSidebar } from "./SidebarContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      {/* Left: Hamburger (mobile) + Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggle}
          className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex-shrink-0"
          aria-label="Menüyü Aç"
          title="Menü"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-slate-100 leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {actions && <div className="flex items-center gap-2">{actions}</div>}

        {/* Search */}
        <button
          className="hidden sm:flex p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label="Ara"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label="Bildirimler"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
        </button>

        {/* Date display */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-slate-300 font-medium">
            {new Date().toLocaleDateString("tr-TR", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Right Hamburger button for mobile ("sağdaki menü hamburger olsun") */}
        <button
          onClick={toggle}
          className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 transition-colors text-xs font-semibold"
          aria-label="Menü"
          title="Menüyü Aç"
        >
          <Menu className="w-4 h-4" />
          <span className="hidden xs:inline">Menü</span>
        </button>
      </div>
    </header>
  );
}
