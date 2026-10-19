import { Header } from "@/components/layout/Header";
import { AttendanceEventForm } from "@/components/attendance/AttendanceEventForm";
import { DayStatusManager } from "@/components/attendance/DayStatusManager";
import prisma from "@/lib/prisma";
import { AttendanceDayStatus } from "@prisma/client";

export const metadata = { title: "Günlük Devam Takibi" };

interface SearchParams {
  employeeId?: string;
  date?: string;
}

export default async function DailyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  const selectedDate = params.date ?? today;
  const selectedEmployeeId = params.employeeId;

  let employees: Array<{ id: string; firstName: string; lastName: string; employeeNo: string }> = [];
  let existingEvents: Array<{
    id: string;
    occurredAt: Date;
    type: "IN" | "OUT";
    source: "MANUAL" | "DEVICE";
    note: string | null;
  }> = [];
  let dayRecord: {
    id: string;
    status: AttendanceDayStatus;
    workedMinutes: number;
    overtimeMinutes: number;
    isApproved: boolean;
  } | null = null;

  try {
    employees = await prisma.employee.findMany({
      where: { status: "ACTIVE", isDeleted: false },
      orderBy: [{ workplace: { name: "asc" } }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, employeeNo: true },
    });

    if (selectedEmployeeId) {
      const workDate = new Date(selectedDate + "T00:00:00Z");
      existingEvents = await prisma.attendanceEvent.findMany({
        where: { employeeId: selectedEmployeeId, workDate },
        orderBy: { occurredAt: "asc" },
        select: { id: true, occurredAt: true, type: true, source: true, note: true },
      }) as typeof existingEvents;

      dayRecord = await prisma.attendanceDay.findUnique({
        where: {
          employeeId_workDate: {
            employeeId: selectedEmployeeId,
            workDate,
          },
        },
        select: {
          id: true,
          status: true,
          workedMinutes: true,
          overtimeMinutes: true,
          isApproved: true,
        },
      });
    }
  } catch {
    // fallback when DB is unreachable
  }

  const STATUS_LABELS: Record<string, string> = {
    PRESENT:        "✅ Çalıştı",
    ABSENT:         "❌ Devamsız",
    HALF_DAY:       "🕐 Yarım Gün",
    ANNUAL_LEAVE:   "🏖 Yıllık İzin",
    SICK_LEAVE:     "🏥 Hastalık İzni",
    EXCUSED:        "📋 Mazeret",
    PUBLIC_HOLIDAY: "🎉 Resmi Tatil",
    REST_DAY:       "😴 İstirahat",
  };

  return (
    <div className="animate-fade-in">
      <Header
        title="Günlük Giriş / Çıkış"
        subtitle="Manuel devam kaydı ekle veya düzelt"
      />

      <div className="p-3 sm:p-6 space-y-4 sm:space-y-5 min-w-0">
        {/* Day summary and status management card */}
        {selectedEmployeeId && (
          <div className="card p-4 flex flex-wrap gap-6 items-center justify-between">
            <div className="flex flex-wrap gap-6 items-center">
              <div>
                <p className="text-xs text-slate-400">Güncel Durum</p>
                <p className="text-sm font-semibold text-slate-100 mt-0.5">
                  {dayRecord ? (STATUS_LABELS[dayRecord.status] ?? dayRecord.status) : "Kayıt Yok"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Net Çalışma</p>
                <p className="text-sm font-mono font-semibold text-slate-100 mt-0.5">
                  {dayRecord ? `${Math.floor(dayRecord.workedMinutes / 60)}s ${dayRecord.workedMinutes % 60}dk` : "0s 0dk"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Fazla Mesai</p>
                <p className="text-sm font-mono font-semibold text-orange-300 mt-0.5">
                  {dayRecord && dayRecord.overtimeMinutes > 0
                    ? `${Math.floor(dayRecord.overtimeMinutes / 60)}s ${dayRecord.overtimeMinutes % 60}dk`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Onay Durumu</p>
                <p className={`text-sm font-semibold mt-0.5 ${dayRecord?.isApproved ? "text-emerald-400" : "text-amber-400"}`}>
                  {dayRecord?.isApproved ? "✓ Onaylı" : "⏳ Onay Bekliyor"}
                </p>
              </div>
            </div>

            {/* Status change dropdown & Approval button */}
            <div className="mt-2 sm:mt-0">
              <DayStatusManager
                dayId={dayRecord?.id}
                employeeId={selectedEmployeeId}
                workDate={selectedDate}
                currentStatus={dayRecord?.status ?? "PRESENT"}
                isApproved={dayRecord?.isApproved ?? false}
              />
            </div>
          </div>
        )}

        <AttendanceEventForm
          employees={employees}
          defaultEmployeeId={selectedEmployeeId}
          defaultDate={selectedDate}
          existingEvents={existingEvents.map((e) => ({
            ...e,
            occurredAt: e.occurredAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
