import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/timezone";
import { AttendanceDayStatus } from "@prisma/client";
import { Calendar, Clock, AlertCircle, ShieldAlert, Award, FileText, CheckCircle2 } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  PRESENT:        { label: "Calisti", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  REST_DAY:       { label: "Hafta Tatili", badge: "bg-slate-700/50 text-slate-300 border-slate-600/40" },
  ANNUAL_LEAVE:   { label: "Yillik Izin", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  SICK_LEAVE:     { label: "Raporlu", badge: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  EXCUSED:        { label: "Mazeret Izni", badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  UNPAID_LEAVE:   { label: "Ucretsiz Izin", badge: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  PUBLIC_HOLIDAY: { label: "Resmi Tatil", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  HALF_DAY:       { label: "Yarim Gun", badge: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
  ABSENT:         { label: "Devamsiz", badge: "bg-red-500/20 text-red-300 border-red-500/30" },
};

function formatMins(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}s ${m > 0 ? `${m}d` : ""}`.trim();
}

export default async function MyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; employeeId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string; employeeId?: string | null } | undefined;

  if (!user) {
    return null;
  }

  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.year ?? String(now.getFullYear()), 10);
  const month = parseInt(sp.month ?? String(now.getMonth() + 1), 10);

  // If user is personel, strictly force their linked employeeId
  let targetEmployeeId = user.role === "personel" ? user.employeeId : (sp.employeeId || user.employeeId);

  // If admin and no employee selected, select first active employee
  if (!targetEmployeeId && user.role === "admin") {
    const firstEmp = await prisma.employee.findFirst({
      where: { isDeleted: false, status: "ACTIVE" },
      select: { id: true },
    });
    targetEmployeeId = firstEmp?.id || null;
  }

  if (!targetEmployeeId) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-1">Bagli Personel Bulunamadi</h2>
          <p className="text-sm text-slate-400">
            Hesabiniza henuz bir personel kaydi atanmamis. Lutfen sistem yoneticinizle iletisime gecin.
          </p>
        </div>
      </div>
    );
  }

  // Fetch employee info
  const employee = await prisma.employee.findUnique({
    where: { id: targetEmployeeId },
    include: { workplace: true, company: true },
  });

  if (!employee) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-1">Personel Kaydi Bulunamadi</h2>
          <p className="text-sm text-slate-400">Aradiginiz personel sistemde mevcut degil.</p>
        </div>
      </div>
    );
  }

  // Days in month
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  const daysInMonth = endDate.getUTCDate();

  // Fetch attendance days
  const attendanceDays = await prisma.attendanceDay.findMany({
    where: {
      employeeId: targetEmployeeId,
      workDate: { gte: startDate, lte: endDate },
    },
  });

  // Fetch shifts
  const shifts = await prisma.shiftAssignment.findMany({
    where: {
      employeeId: targetEmployeeId,
      workDate: { gte: startDate, lte: endDate },
    },
  });

  // Fetch public holidays
  const holidays = await prisma.publicHoliday.findMany({
    where: {
      companyId: employee.companyId,
      date: { gte: startDate, lte: endDate },
    },
  });
  const holidayMap = new Map<string, typeof holidays[0]>();
  holidays.forEach((h) => {
    holidayMap.set(h.date.toISOString().slice(0, 10), h);
  });

  // Quick lookup maps
  const dayMap = new Map<string, typeof attendanceDays[0]>();
  attendanceDays.forEach((d) => {
    const key = d.workDate.toISOString().slice(0, 10);
    dayMap.set(key, d);
  });

  const shiftMap = new Map<string, typeof shifts[0]>();
  shifts.forEach((s) => {
    const key = s.workDate.toISOString().slice(0, 10);
    shiftMap.set(key, s);
  });

  // Calculate monthly stats
  let totalWorkedMins = 0;
  let totalOvertimeMins = 0;
  let presentDaysCount = 0;
  let annualLeaveDaysCount = 0;
  let sickLeaveDaysCount = 0;
  let restDaysCount = 0;
  let publicHolidaysCount = holidays.length;

  attendanceDays.forEach((d) => {
    totalWorkedMins += d.workedMinutes;
    totalOvertimeMins += d.overtimeMinutes;
    if (d.status === "PRESENT" || d.status === "HALF_DAY") presentDaysCount++;
    if (d.status === "ANNUAL_LEAVE") annualLeaveDaysCount++;
    if (d.status === "SICK_LEAVE") sickLeaveDaysCount++;
    if (d.status === "REST_DAY") restDaysCount++;
  });

  // Generate day list
  const rows = [];
  const dayNames = ["Paz", "Pzt", "Sal", "Car", "Per", "Cum", "Cmt"];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(Date.UTC(year, month - 1, d));
    const dateStr = dateObj.toISOString().slice(0, 10);
    const dayName = dayNames[dateObj.getUTCDay()];
    const isWeekend = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;

    const dayRecord = dayMap.get(dateStr);
    const shift = shiftMap.get(dateStr);
    const holiday = holidayMap.get(dateStr);

    let shiftText = "-";
    if (holiday) {
      shiftText = `🎌 ${holiday.name} (${holiday.type === "HALF_DAY" ? "Yarım Gün" : "Tam Gün Tatil"})`;
    } else if (shift) {
      const sH = String((shift.plannedStartAt.getUTCHours() + 3) % 24).padStart(2, "0");
      const sM = String(shift.plannedStartAt.getUTCMinutes()).padStart(2, "0");
      const eH = String((shift.plannedEndAt.getUTCHours() + 3) % 24).padStart(2, "0");
      const eM = String(shift.plannedEndAt.getUTCMinutes()).padStart(2, "0");
      shiftText = `${sH}:${sM} - ${eH}:${eM} (${shift.breakPolicyMinutes} dk mola)`;
    }

    const defaultStatus = holiday
      ? "PUBLIC_HOLIDAY"
      : isWeekend
      ? "REST_DAY"
      : "ABSENT";

    rows.push({
      day: d,
      dateStr,
      dayName,
      isWeekend,
      shiftText,
      holidayName: holiday?.name,
      status: dayRecord?.status || defaultStatus,
      workedMinutes: dayRecord?.workedMinutes || 0,
      overtimeMinutes: dayRecord?.overtimeMinutes || 0,
      isApproved: dayRecord?.isApproved || false,
      note: dayRecord?.note || (holiday ? `Resmi Tatil: ${holiday.name}` : ""),
    });
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
            <Award className="w-4 h-4" />
            Personel Puantaj ve Devam Ozeti
          </div>
          <h1 className="text-2xl font-black text-white">
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-sm text-slate-400">
            Sicil No: <span className="text-slate-200 font-mono">{employee.employeeNo}</span> • Gorev Yeri:{" "}
            <span className="text-slate-200">{employee.workplace.name}</span>
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <form method="GET" className="flex items-center gap-2">
            {user.role === "admin" && (
              <input type="hidden" name="employeeId" value={targetEmployeeId} />
            )}
            <select
              name="year"
              defaultValue={year}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              name="month"
              defaultValue={month}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2"
            >
              {[
                "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
                "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"
              ].map((mName, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {mName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Filtrele
            </button>
          </form>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Clock className="w-4 h-4 text-emerald-400" />
            Toplam Calisma
          </div>
          <p className="text-xl font-bold text-white">{formatMins(totalWorkedMins)}</p>
          <p className="text-xs text-slate-500">{presentDaysCount} calisilan gun</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Award className="w-4 h-4 text-purple-400" />
            Fazla Mesai (FM)
          </div>
          <p className="text-xl font-bold text-purple-300">{formatMins(totalOvertimeMins)}</p>
          <p className="text-xs text-slate-500">{totalOvertimeMins > 0 ? "Onay bekleyen/onayli" : "Ek mesai yok"}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Calendar className="w-4 h-4 text-blue-400" />
            Yillik Izin
          </div>
          <p className="text-xl font-bold text-blue-300">{annualLeaveDaysCount} Gun</p>
          <p className="text-xs text-slate-500">Bu ay kullanilan</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <FileText className="w-4 h-4 text-amber-400" />
            Raporlu Gunler
          </div>
          <p className="text-xl font-bold text-amber-300">{sickLeaveDaysCount} Gun</p>
          <p className="text-xs text-slate-500">Saglik istirahati</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            Hafta Tatili
          </div>
          <p className="text-xl font-bold text-slate-300">{restDaysCount} Gun</p>
          <p className="text-xs text-slate-500">Tatil / dinlenme</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
            Resmi Tatil
          </div>
          <p className="text-xl font-bold text-purple-300">{publicHolidaysCount} Gun</p>
          <p className="text-xs text-slate-500">Kanuni tatiller</p>
        </div>
      </div>

      {/* Read-only Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            Aylik Gun Bazli Devam ve Puantaj Cizelgesi (Salt Okunur)
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {daysInMonth} Gun
          </span>
        </div>

        <div className="overflow-x-auto touch-pan-x overscroll-x-contain">
          <table className="w-full text-left text-sm min-w-[640px]">
            <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">Atanmis Vardiya</th>
                <th className="py-3 px-4">Durum</th>
                <th className="py-3 px-4 text-right">Calisma Suresi</th>
                <th className="py-3 px-4 text-right">Fazla Mesai (FM)</th>
                <th className="py-3 px-4 text-center">Onay</th>
                <th className="py-3 px-4">Aciklama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((r) => {
                const statusMeta = STATUS_LABELS[r.status] || { label: r.status, badge: "bg-slate-700 text-slate-300" };
                return (
                  <tr
                    key={r.day}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      r.isWeekend ? "bg-slate-950/30" : ""
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-slate-300">{r.day}</span>{" "}
                      <span className="text-xs text-slate-500 font-medium">({r.dayName})</span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-300">
                      {r.shiftText}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusMeta.badge}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-200">
                      {r.workedMinutes > 0 ? formatMins(r.workedMinutes) : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {r.overtimeMinutes > 0 ? (
                        <span className="text-purple-400 font-bold">+{formatMins(r.overtimeMinutes)}</span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {r.isApproved ? (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" title="Onaylandi" />
                      ) : (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-700" title="Taslak / Bekliyor" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 max-w-xs truncate">
                      {r.note || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
