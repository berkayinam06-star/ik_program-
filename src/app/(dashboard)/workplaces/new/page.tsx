import { Header } from "@/components/layout/Header";
import { WorkplaceForm } from "@/components/workplaces/WorkplaceForm";
import prisma from "@/lib/prisma";

export const metadata = { title: "Yeni Görev Yeri" };

export default async function NewWorkplacePage() {
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });

  if (companies.length === 0) {
    return (
      <div className="animate-fade-in">
        <Header title="Yeni Görev Yeri" subtitle="Görev yeri ekle" />
        <div className="p-6">
          <div className="card p-6 text-slate-400 text-sm">
            Önce bir şirket oluşturmanız gerekmektedir.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Header title="Yeni Görev Yeri" subtitle="Görev yeri bilgilerini girin" />
      <div className="p-6">
        <WorkplaceForm companies={companies} />
      </div>
    </div>
  );
}
