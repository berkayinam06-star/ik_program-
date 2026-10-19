import { Header } from "@/components/layout/Header";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

export const metadata = { title: "Personel Düzenle" };

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [employee, companies, workplaces] = await Promise.all([
    prisma.employee.findUnique({ where: { id } }),
    prisma.company.findMany({ orderBy: { name: "asc" } }),
    prisma.workplace.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!employee) notFound();

  return (
    <div className="animate-fade-in">
      <Header
        title="Personel Düzenle"
        subtitle={`${employee.lastName} ${employee.firstName} — #${employee.employeeNo}`}
      />
      <div className="p-6">
        <EmployeeForm
          companies={companies}
          workplaces={workplaces}
          initialData={{
            id:          employee.id,
            companyId:   employee.companyId,
            workplaceId: employee.workplaceId,
            employeeNo:  employee.employeeNo,
            firstName:   employee.firstName,
            lastName:    employee.lastName,
            startDate:   employee.startDate.toISOString().slice(0, 10),
            endDate:     employee.endDate ? employee.endDate.toISOString().slice(0, 10) : null,
            status:      employee.status,
            position:    employee.position,
          }}
        />
      </div>
    </div>
  );
}
