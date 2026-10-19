import { Header } from "@/components/layout/Header";
import prisma from "@/lib/prisma";
import {
  Users,
  Building2,
  ClipboardCheck,
  TrendingUp,
  ArrowUpRight,
  Clock,
  UserCheck,
  AlertCircle,
  Database,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function getDashboardStats() {
  try {
    const [totalEmployees, totalWorkplaces, todayEvents, pendingApprovals] =
      await Promise.all([
        prisma.employee.count({ where: { status: "ACTIVE", isDeleted: false } }),
        prisma.workplace.count(),
        prisma.attendanceEvent.count({
          where: {
            workDate: new Date(new Date().toISOString().slice(0, 10)),
            employee: { isDeleted: false },
          },
        }),
        prisma.attendanceDay.count({
          where: {
            isApproved: false,
            employee: { isDeleted: false },
          },
        }),
      ]);

    return { totalEmployees, totalWorkplaces, todayEvents, pendingApprovals, isDbConnected: true };
  } catch (error) {
    console.warn("PostgreSQL bağlantısı kurulamadı:", error);
    return { totalEmployees: 0, totalWorkplaces: 0, todayEvents: 0, pendingApprovals: 0, isDbConnected: false };
  }
}

async function getRecentEvents() {
  try {
    return await prisma.attendanceEvent.findMany({
      take: 8,
      orderBy: { occurredAt: "desc" },
      include: {
        employee: { select: { firstName: true, lastName: true, workplace: { select: { name: true } } } },
      },
    });
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (user?.role === "personel") {
    redirect("/my-attendance");
  }

  const stats = await getDashboardStats();
  const recentEvents = await getRecentEvents();

  const statCards = [
    {
      label: "Aktif Personel",
      value: stats.totalEmployees,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      href: "/employees",
      change: "Toplam aktif çalışan",
    },
    {
      label: "Görev Yerleri",
      value: stats.totalWorkplaces,
      icon: Building2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      href: "/workplaces",
      change: "Aktif tesis",
    },
    {
      label: "Bugün İşlem",
      value: stats.todayEvents,
      icon: Clock,
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
      href: "/attendance/daily",
      change: "Giriş/Çıkış kaydı",
    },
    {
      label: "Onay Bekleyen",
      value: stats.pendingApprovals,
      icon: AlertCircle,
      color: "text-orange-400",
      bg: "bg-orange-500/10 border-orange-500/20",
      href: "/payroll",
      change: "Gün kaydı",
    },
  ];

  return (
    <div className="animate-fade-in">
      <Header
        title="Genel Bakış"
        subtitle="İK Yönetim Sistemi — Hoş geldiniz"
      />

      <div className="p-6 space-y-6">
        {!stats.isDbConnected && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 backdrop-blur-sm shadow-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0">
                <Database className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <h3 className="text-base font-semibold text-amber-200">
                    PostgreSQL Veritabanı Bağlantısı Bekleniyor
                  </h3>
                  <p className="text-sm text-slate-300 mt-1">
                    Next.js arayüzü ve sayfalar başarıyla çalışıyor. Canlı personel ve puantaj verilerini görüntülemek için PostgreSQL veritabanınızı başlatmanız gerekmektedir.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
                    <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-blue-400" /> Seçenek A: Yerel PostgreSQL (Windows Winget)
                    </p>
                    <p className="text-slate-400">Yönetici PowerShell açıp şu komutu çalıştırın:</p>
                    <code className="block bg-slate-950 px-3 py-2 rounded text-blue-300 font-mono text-[11px] select-all">
                      winget install PostgreSQL.PostgreSQL.16
                    </code>
                    <p className="text-slate-500 text-[10px]">Kurulumda şifreyi <strong>password</strong> yapınız (.env ile eşleşir).</p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
                    <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-emerald-400" /> Seçenek B: Ücretsiz Bulut PostgreSQL (Neon / Supabase)
                    </p>
                    <p className="text-slate-400">10 saniyede kurulumsuz ücretsiz DB açıp linki <strong className="text-slate-300">.env</strong> dosyasına yapıştırın:</p>
                    <code className="block bg-slate-950 px-3 py-2 rounded text-emerald-300 font-mono text-[11px]">
                      DATABASE_URL=&quot;postgresql://...&quot;
                    </code>
                  </div>
                </div>

                <div className="pt-2 text-xs text-slate-400 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
                  Veritabanı açıldıktan sonra terminalde <code className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded">npm run db:migrate</code> ve <code className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded">npm run db:seed</code> çalıştırmanız yeterlidir.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Link key={card.label} href={card.href} className="card-hover p-5 group transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl border ${card.bg}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-100 mb-1">
                  {card.value.toLocaleString("tr-TR")}
                </p>
                <p className="text-sm font-medium text-slate-300">{card.label}</p>
                <p className="text-xs text-slate-500 mt-1">{card.change}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions + Recent Events */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Hızlı Erişim
            </h2>
            <div className="space-y-2">
              {[
                { label: "Personel Ekle",             href: "/employees/new",         icon: Users,          color: "text-blue-400" },
                { label: "Giriş/Çıkış Kaydı Ekle",   href: "/attendance/daily",       icon: Clock,          color: "text-violet-400" },
                { label: "Aylık Puantajı Görüntüle",  href: "/attendance/monthly",     icon: ClipboardCheck, color: "text-emerald-400" },
                { label: "Görev Yeri Ekle",           href: "/workplaces/new",         icon: Building2,      color: "text-orange-400" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 transition-all group"
                >
                  <action.icon className={`w-4 h-4 ${action.color} flex-shrink-0`} />
                  <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">
                    {action.label}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 ml-auto group-hover:text-slate-400" />
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Attendance Events */}
          <div className="card p-5 xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                Son Devam Hareketleri
              </h2>
              <Link href="/attendance/daily" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Tümünü Gör →
              </Link>
            </div>

            {recentEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Henüz hareket kaydı yok.
              </div>
            ) : (
              <div className="space-y-2">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-900/50 border border-slate-700/30"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        event.type === "IN"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {event.type === "IN" ? "G" : "Ç"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {event.employee.lastName} {event.employee.firstName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {event.employee.workplace.name}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono text-slate-300">
                        {new Date(event.occurredAt).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Europe/Istanbul",
                        })}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(event.occurredAt).toLocaleDateString("tr-TR", {
                          day: "2-digit",
                          month: "short",
                          timeZone: "Europe/Istanbul",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
