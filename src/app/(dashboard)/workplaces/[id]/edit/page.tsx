import { Header } from "@/components/layout/Header";
import { WorkplaceForm } from "@/components/workplaces/WorkplaceForm";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

export const metadata = { title: "Görev Yeri Düzenle" };

export default async function EditWorkplacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [workplace, companies] = await Promise.all([
    prisma.workplace.findUnique({ where: { id } }),
    prisma.company.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!workplace) notFound();

  return (
    <div className="animate-fade-in">
      <Header title="Görev Yeri Düzenle" subtitle={workplace.name} />
      <div className="p-6">
        <WorkplaceForm
          companies={companies}
          initialData={{
            id:                workplace.id,
            companyId:         workplace.companyId,
            name:              workplace.name,
            sgkRegistrationNo: workplace.sgkRegistrationNo,
          }}
        />
      </div>
    </div>
  );
}
