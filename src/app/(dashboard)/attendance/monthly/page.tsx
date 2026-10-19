import { Header } from "@/components/layout/Header";
import { MonthlyMatrix } from "@/components/attendance/MonthlyMatrix";
import prisma from "@/lib/prisma";
import { getDaysInMonth } from "@/lib/timezone";

export const metadata = { title: "Aylık Puantaj" };

interface SearchParams {
  year?: string;
  month?: string;
  workplaceId?: string;
  companyId?: string;
}

export default async function MonthlyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const now = new Date();

  const year       = parseInt(params.year  ?? String(now.getFullYear()), 10);
  const month      = parseInt(params.month ?? String(now.getMonth() + 1), 10);
  const workplaceId = params.workplaceId;

  let companies: Array<{ id: string; name: string }> = [];
  let workplaces: Array<{ id: string; name: string; companyId: string }> = [];
  let employees: Array<{ id: string; firstName: string; lastName: string; employeeNo: string; position: string | null; workplace: { name: string } }> = [];
  let attendanceDays: Array<{ id: string; employeeId: string; workDate: Date; status: string; workedMinutes: number; overtimeMinutes: number; isApproved: boolean }> = [];
  let period: { isLocked: boolean; lockedAt: Date | null } | null = null;
  let holidays: Array<{ date: string; name: string; type: string }> = [];

  try {
    [companies, workplaces] = await Promise.all([
      prisma.company.findMany({ orderBy: { name: "asc" } }),
      prisma.workplace.findMany({ orderBy: { name: "asc" } }),
    ]);

    const selectedCompanyId = params.companyId ?? (companies[0]?.id ?? "");

    if (selectedCompanyId) {
      employees = await prisma.employee.findMany({
        where: {
          companyId: selectedCompanyId,
          isDeleted: false,
          ...(workplaceId ? { workplaceId } : {}),
          status: "ACTIVE",
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNo: true,
          position: true,
          workplace: { select: { name: true } },
        },
        orderBy: [{ workplace: { name: "asc" } }, { lastName: "asc" }],
      });

      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate   = new Date(Date.UTC(year, month, 0));

      attendanceDays = await prisma.attendanceDay.findMany({
        where: {
          employeeId: { in: employees.map((e) => e.id) },
          workDate: { gte: startDate, lte: endDate },
        },
      }) as typeof attendanceDays;

      period = await prisma.payrollPeriod.findUnique({
        where: { companyId_year_month: { companyId: selectedCompanyId, year, month } },
      });

      // Fetch public holidays for this company and month
      const startDate2 = new Date(Date.UTC(year, month - 1, 1));
      const endDate2   = new Date(Date.UTC(year, month, 0));
      const rawHolidays = await prisma.publicHoliday.findMany({
        where: {
          companyId: selectedCompanyId,
          date: { gte: startDate2, lte: endDate2 },
        },
        orderBy: { date: "asc" },
      });
      holidays = rawHolidays.map((h) => ({
        date: h.date.toISOString(),
        name: h.name,
        type: h.type,
      }));
    }
  } catch {
    // DB offline fallback
  }

  const selectedCompanyId = params.companyId ?? (companies[0]?.id ?? "");
  const days = getDaysInMonth(year, month);

  return (
    <div className="animate-fade-in">
      <Header
        title="Aylık Puantaj Matrisi"
        subtitle={`${year} / ${String(month).padStart(2, "0")} — Devam Çizelgesi`}
      />

      <div className="p-6">
        <MonthlyMatrix
          companies={companies}
          workplaces={workplaces}
          employees={employees.map((e) => ({
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            employeeNo: e.employeeNo,
            workplaceName: e.workplace.name,
          }))}
          days={days.map((d) => d.toISOString())}
          attendanceDays={attendanceDays.map((d) => ({
            id: d.id,
            employeeId: d.employeeId,
            workDate: d.workDate.toISOString(),
            status: d.status,
            workedMinutes: d.workedMinutes,
            overtimeMinutes: d.overtimeMinutes,
            isApproved: d.isApproved,
          }))}
          year={year}
          month={month}
          selectedWorkplaceId={workplaceId}
          selectedCompanyId={selectedCompanyId}
          isLocked={period?.isLocked ?? false}
          publicHolidays={holidays}
        />
      </div>
    </div>
  );
}
