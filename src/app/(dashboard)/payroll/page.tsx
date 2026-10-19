import { Header } from "@/components/layout/Header";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Lock, Unlock, Building2, Calendar } from "lucide-react";

export const metadata = { title: "Dönem Yönetimi" };

const MONTHS_TR = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export default async function PayrollPage() {
  const companies = await prisma.company.findMany({
    include: { payrollPeriods: { orderBy: [{ year: "desc" }, { month: "desc" }] } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="animate-fade-in">
      <Header
        title="Dönem Yönetimi"
        subtitle="Puantaj dönemlerini onaylayın ve kilitleyin"
      />

      <div className="p-6 space-y-6">
        {companies.map((company) => (
          <div key={company.id} className="card overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 bg-slate-900/50">
              <Building2 className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-200">{company.name}</h2>
              <span className="badge-gray ml-auto">{company.payrollPeriods.length} dönem</span>
            </div>

            {company.payrollPeriods.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-500 text-sm">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Henüz dönem kaydı yok. Aylık puantaj sayfasından dönem oluşturabilirsiniz.
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {company.payrollPeriods.map((period) => (
                  <div key={period.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm font-medium text-slate-200">
                        {MONTHS_TR[period.month]} {period.year}
                      </span>
                      {period.isLocked ? (
                        <span className="badge-red flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Kilitli
                        </span>
                      ) : (
                        <span className="badge-green flex items-center gap-1">
                          <Unlock className="w-3 h-3" />
                          Açık
                        </span>
                      )}
                    </div>

                    {period.lockedAt && (
                      <p className="text-xs text-slate-500">
                        {new Date(period.lockedAt).toLocaleDateString("tr-TR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          timeZone: "Europe/Istanbul",
                        })}
                      </p>
                    )}

                    <Link
                      href={`/attendance/monthly?companyId=${company.id}&year=${period.year}&month=${period.month}`}
                      className="btn-secondary btn-sm"
                    >
                      Puantajı Gör
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {companies.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-slate-400">Şirket bulunamadı.</p>
          </div>
        )}
      </div>
    </div>
  );
}
