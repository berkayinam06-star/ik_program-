import { Header } from "@/components/layout/Header";
import { ShiftForm } from "@/components/shifts/ShiftForm";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/timezone";

export const metadata = { title: "Vardiya Yönetimi" };

interface SearchParams {
  employeeId?: string;
  year?: string;
  month?: string;
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year  = parseInt(params.year  ?? String(now.getFullYear()),  10);
  const month = parseInt(params.month ?? String(now.getMonth() + 1), 10);
  const selectedEmployeeId = params.employeeId;

  let employees: Array<{ id: string; firstName: string; lastName: string; employeeNo: string; workplace: { name: string } }> = [];
  let shifts: Array<{
    id: string;
    employeeId: string;
    workDate: Date;
    plannedStartAt: Date;
    plannedEndAt: Date;
    breakPolicyMinutes: number;
    employee: { firstName: string; lastName: string; employeeNo: string; workplace: { name: string } };
  }> = [];

  try {
    employees = await prisma.employee.findMany({
      where: { status: "ACTIVE", isDeleted: false },
      orderBy: [{ workplace: { name: "asc" } }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNo: true,
        workplace: { select: { name: true } },
      },
    });

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate   = new Date(Date.UTC(year, month, 0));

    shifts = await prisma.shiftAssignment.findMany({
      where: {
        workDate: { gte: startDate, lte: endDate },
        ...(selectedEmployeeId ? { employeeId: selectedEmployeeId } : {}),
      },
      orderBy: [{ workDate: "asc" }, { employee: { lastName: "asc" } }],
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNo: true,
            workplace: { select: { name: true } },
          },
        },
      },
    });
  } catch {
    // DB offline fallback
  }

  const MONTHS_TR = [
    "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];

  return (
    <div className="animate-fade-in">
      <Header
        title="Vardiya Yönetimi"
        subtitle="Personel vardiya planı oluştur ve düzenle"
      />

      <div className="p-6 space-y-6">
        {/* Shift Assignment Form */}
        <ShiftForm
          employees={employees.map((e) => ({
            id: e.id,
            label: `[${e.employeeNo}] ${e.lastName} ${e.firstName} — ${e.workplace.name}`,
          }))}
          defaultEmployeeId={selectedEmployeeId}
          year={year}
          month={month}
        />

        {/* Existing Shifts Table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">
              {MONTHS_TR[month]} {year} — Vardiya Listesi
              <span className="ml-2 text-slate-500 font-normal">({shifts.length} kayıt)</span>
            </h3>
          </div>

          {shifts.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              Bu ay için vardiya planı bulunamadı.
            </div>
          ) : (
            <div className="table-container">
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Personel</th>
                    <th>Görev Yeri</th>
                    <th>Planlanan Giriş</th>
                    <th>Planlanan Çıkış</th>
                    <th>Mola (dk)</th>
                    <th className="text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s) => {
                    const startTime = new Date(s.plannedStartAt).toLocaleTimeString("tr-TR", {
                      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
                    });
                    const endTime = new Date(s.plannedEndAt).toLocaleTimeString("tr-TR", {
                      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
                    });
                    return (
                      <tr key={s.id}>
                        <td>
                          <span className="font-mono text-slate-300">{formatDate(s.workDate)}</span>
                        </td>
                        <td>
                          <span className="text-slate-200">{s.employee.lastName} {s.employee.firstName}</span>
                          <span className="text-xs text-slate-500 ml-1">#{s.employee.employeeNo}</span>
                        </td>
                        <td><span className="text-slate-400">{s.employee.workplace.name}</span></td>
                        <td><span className="font-mono text-emerald-400">{startTime}</span></td>
                        <td><span className="font-mono text-red-400">{endTime}</span></td>
                        <td><span className="text-slate-400">{s.breakPolicyMinutes}</span></td>
                        <td className="text-right">
                          <DeleteShiftButton shiftId={s.id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { DeleteShiftButton } from "@/components/shifts/DeleteShiftButton";

