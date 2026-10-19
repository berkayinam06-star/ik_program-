import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { HolidaysClient } from "@/components/holidays/HolidaysClient";

export const metadata = { title: "Resmi Tatil Yönetimi | İK Yönetim Sistemi" };

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.year ?? String(now.getFullYear()), 10);

  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  const selectedCompanyId = sp.companyId ?? (companies[0]?.id ?? "");

  const holidays = selectedCompanyId
    ? await prisma.publicHoliday.findMany({
        where: {
          companyId: selectedCompanyId,
          date: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lte: new Date(Date.UTC(year, 11, 31)),
          },
        },
        orderBy: { date: "asc" },
      })
    : [];

  return (
    <div className="animate-fade-in">
      <Header
        title="Resmi Tatil Yönetimi"
        subtitle="Şirkete özel resmi tatil ve özel günleri tanımlayın"
      />
      <div className="p-6">
        <HolidaysClient
          companies={companies}
          selectedCompanyId={selectedCompanyId}
          year={year}
          initialHolidays={holidays.map((h) => ({
            id: h.id,
            companyId: h.companyId,
            date: h.date.toISOString(),
            name: h.name,
            type: h.type,
            description: h.description ?? "",
          }))}
        />
      </div>
    </div>
  );
}
