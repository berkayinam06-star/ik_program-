import { Header } from "@/components/layout/Header";
import { CompaniesManager } from "@/components/companies/CompaniesManager";
import prisma from "@/lib/prisma";

export const metadata = { title: "Şirket Yönetimi" };

export default async function CompaniesPage() {
  let companies: Array<{ id: string; name: string; createdAt: Date }> = [];

  try {
    companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
    });
  } catch {
    // DB offline fallback
  }

  return (
    <div className="animate-fade-in">
      <Header
        title="Şirket Yönetimi"
        subtitle="Şirketleri listele, ekle, düzenle veya sil"
      />

      <div className="p-6">
        <CompaniesManager
          companies={companies.map((c) => ({
            id: c.id,
            name: c.name,
            createdAt: c.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
