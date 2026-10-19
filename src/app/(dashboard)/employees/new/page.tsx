import { Header } from "@/components/layout/Header";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import prisma from "@/lib/prisma";

export const metadata = { title: "Yeni Personel" };

export default async function NewEmployeePage() {
  const [companies, workplaces] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" } }),
    prisma.workplace.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="animate-fade-in">
      <Header title="Yeni Personel" subtitle="Personel bilgilerini girin" />
      <div className="p-6">
        <EmployeeForm companies={companies} workplaces={workplaces} />
      </div>
    </div>
  );
}
