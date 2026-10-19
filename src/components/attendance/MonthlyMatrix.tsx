"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import { formatMinutes } from "@/lib/timezone";

const DOW = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

const STATUS_CELL: Record<string, { label: string; className: string; fullLabel: string }> = {
  PRESENT:        { label: "✓",  className: "bg-emerald-900/40 text-emerald-300 border-emerald-800/50",  fullLabel: "Çalıştı" },
  ABSENT:         { label: "D",  className: "bg-red-900/40 text-red-300 border-red-800/50",              fullLabel: "Devamsız" },
  HALF_DAY:       { label: "Y",  className: "bg-blue-900/40 text-blue-300 border-blue-800/50",           fullLabel: "Yarım Gün" },
  ANNUAL_LEAVE:   { label: "İ",  className: "bg-violet-900/40 text-violet-300 border-violet-800/50",     fullLabel: "Yıllık İzin" },
  SICK_LEAVE:     { label: "H",  className: "bg-yellow-900/40 text-yellow-300 border-yellow-800/50",     fullLabel: "Hastalık/Rapor" },
  EXCUSED:        { label: "M",  className: "bg-orange-900/40 text-orange-300 border-orange-800/50",     fullLabel: "Mazeret" },
  PUBLIC_HOLIDAY: { label: "T",  className: "bg-slate-700/50 text-slate-400 border-slate-600/50",        fullLabel: "Resmi Tatil" },
  REST_DAY:       { label: "İ",  className: "bg-slate-700/50 text-slate-500 border-slate-600/30",        fullLabel: "İstirahat" },
};

const SETTABLE_STATUSES = [
  "ANNUAL_LEAVE", "SICK_LEAVE", "EXCUSED", "HALF_DAY", "PUBLIC_HOLIDAY", "REST_DAY", "ABSENT",
] as const;

interface AttendanceDay {
  id: string;
  employeeId: string;
  workDate: string;
  status: string;
  workedMinutes: number;
  overtimeMinutes: number;
  isApproved: boolean;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  workplaceName: string;
}

interface Props {
  companies: { id: string; name: string }[];
  workplaces: { id: string; name: string }[];
  employees: Employee[];
  days: string[]; // ISO strings
  attendanceDays: AttendanceDay[];
  year: number;
  month: number;
  selectedWorkplaceId?: string;
  selectedCompanyId: string;
  isLocked: boolean;
  publicHolidays?: { date: string; name: string; type: string }[];
}

interface CellMenuState {
  dayId: string | null;   // existing record id
  employeeId: string;
  workDate: string;
  currentStatus: string;
  workedMinutes: number;
  x: number;
  y: number;
}

export function MonthlyMatrix({
  companies,
  workplaces,
  employees,
  days,
  attendanceDays,
  year,
  month,
  selectedWorkplaceId,
  selectedCompanyId,
  isLocked,
  publicHolidays = [],
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError]            = useState<string | null>(null);
  const [cellMenu, setCellMenu]      = useState<CellMenuState | null>(null);
  const [localDays, setLocalDays]    = useState<AttendanceDay[]>(attendanceDays);

  // Build lookup map (updated optimistically)
  const dayMap = new Map<string, Map<string, AttendanceDay>>();
  for (const day of localDays) {
    if (!dayMap.has(day.employeeId)) dayMap.set(day.employeeId, new Map());
    dayMap.get(day.employeeId)!.set(day.workDate.slice(0, 10), day);
  }

  // Build holiday lookup map: dateKey -> { name, type }
  const holidayMap = new Map<string, { name: string; type: string }>();
  for (const h of publicHolidays) {
    holidayMap.set(h.date.slice(0, 10), { name: h.name, type: h.type });
  }

  const navigate = (delta: number) => {
    let newMonth = month + delta;
    let newYear  = year;
    if (newMonth > 12) { newMonth = 1;  newYear++; }
    if (newMonth < 1)  { newMonth = 12; newYear--; }

    const params = new URLSearchParams({
      year:  String(newYear),
      month: String(newMonth),
      ...(selectedCompanyId   ? { companyId:   selectedCompanyId  } : {}),
      ...(selectedWorkplaceId ? { workplaceId: selectedWorkplaceId } : {}),
    });
    router.push(`/attendance/monthly?${params}`);
  };

  const applyFilter = (key: string, value: string) => {
    const params = new URLSearchParams({
      year:  String(year),
      month: String(month),
      companyId: selectedCompanyId,
    });
    if (key !== "workplaceId" && selectedWorkplaceId) params.set("workplaceId", selectedWorkplaceId);
    if (value) params.set(key, value);
    router.push(`/attendance/monthly?${params}`);
  };

  const handleLockToggle = () => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/payroll/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: selectedCompanyId, year, month, lock: !isLocked }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "İşlem başarısız");
        }
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Hata");
      }
    });
  };

  const handleExcelExport = () => {
    const params = new URLSearchParams({
      year:      String(year),
      month:     String(month),
      companyId: selectedCompanyId,
      ...(selectedWorkplaceId ? { workplaceId: selectedWorkplaceId } : {}),
    });
    window.open(`/api/attendance/export?${params}`, "_blank");
  };

  const isWeekend = (isoDate: string) => {
    const d = new Date(isoDate);
    const dow = d.getUTCDay();
    return dow === 0 || dow === 6;
  };

  // Cell right-click / click context menu
  const handleCellClick = (
    e: React.MouseEvent,
    dayRecord: AttendanceDay | undefined,
    employeeId: string,
    day: string
  ) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCellMenu({
      dayId: dayRecord?.id ?? null,
      employeeId,
      workDate: day.slice(0, 10),
      currentStatus: dayRecord?.status ?? "",
      workedMinutes: dayRecord?.workedMinutes ?? 0,
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY,
    });
  };

  const handleStatusSet = (status: string, workedMinutes?: number) => {
    if (!cellMenu) return;
    const { dayId, employeeId, workDate } = cellMenu;
    setCellMenu(null);

    startTransition(async () => {
      setError(null);
      try {
        let res: Response;
        if (dayId) {
          res = await fetch(`/api/attendance/days/${dayId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status,
              ...(workedMinutes !== undefined ? { workedMinutes } : {}),
            }),
          });
        } else {
          res = await fetch("/api/attendance/days", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId,
              workDate,
              status,
              ...(workedMinutes !== undefined ? { workedMinutes } : {}),
            }),
          });
        }

        if (!res.ok) throw new Error((await res.json()).error ?? "Hata");
        const updated = await res.json();

        // Optimistic update
        setLocalDays((prev) => {
          const exists = prev.find(
            (d) =>
              d.id === updated.id ||
              (d.employeeId === employeeId && d.workDate.slice(0, 10) === workDate)
          );
          if (exists) {
            return prev.map((d) => (d.id === exists.id ? { ...d, ...updated } : d));
          }
          return [
            ...prev,
            { ...updated, workDate: updated.workDate ?? workDate + "T00:00:00.000Z" },
          ];
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Hata");
        router.refresh();
      }
    });
  };

  const handleDeleteDayRecord = (dayId: string) => {
    setCellMenu(null);

    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/attendance/days/${dayId}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Silinemedi");
        setLocalDays((prev) => prev.filter((d) => d.id !== dayId));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Hata");
        router.refresh();
      }
    });
  };

  const handleApproveToggle = (dayId: string, currentApproved: boolean) => {
    if (isLocked) return;

    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/attendance/days/${dayId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isApproved: !currentApproved }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Hata");
        const updated = await res.json();
        setLocalDays((prev) =>
          prev.map((d) => (d.id === dayId ? { ...d, isApproved: updated.isApproved } : d))
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Hata");
      }
    });
  };

  const MONTHS_TR = [
    "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];

  return (
    <div className="space-y-4" onClick={() => setCellMenu(null)}>
      {/* Toolbar */}
      <div className="card p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Month navigation */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <button onClick={() => navigate(-1)} className="btn-secondary btn-icon btn-sm" aria-label="Önceki Ay">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-200 w-28 text-center">
            {MONTHS_TR[month]} {year}
          </span>
          <button onClick={() => navigate(1)} className="btn-secondary btn-icon btn-sm" aria-label="Sonraki Ay">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="hidden sm:block w-px h-6 bg-slate-700" />

        {/* Company filter */}
        <select
          className="select w-full sm:w-44 text-xs sm:text-sm"
          value={selectedCompanyId}
          onChange={(e) => applyFilter("companyId", e.target.value)}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Workplace filter */}
        <select
          className="select w-full sm:w-44 text-xs sm:text-sm"
          value={selectedWorkplaceId ?? ""}
          onChange={(e) => applyFilter("workplaceId", e.target.value)}
        >
          <option value="">Tüm Görev Yerleri</option>
          {workplaces.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        <div className="hidden sm:block flex-1" />

        {/* Lock / Unlock and Export */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-1 sm:pt-0">
          <button
            onClick={handleLockToggle}
            disabled={isPending || !selectedCompanyId}
            className={clsx("btn btn-sm gap-2 flex-1 sm:flex-initial", isLocked ? "btn-danger" : "btn-success")}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isLocked ? (
              <><Unlock className="w-4 h-4" /> Kilidi Aç</>
            ) : (
              <><Lock className="w-4 h-4" /> Dönemi Onayla</>
            )}
          </button>

          <button onClick={handleExcelExport} className="btn-secondary btn-sm flex-1 sm:flex-initial gap-1.5">
            <Download className="w-4 h-4" />
            Excel İndir
          </button>
        </div>
      </div>

      {/* Lock status banner */}
      {isLocked && (
        <div className="px-4 py-3 rounded-lg bg-amber-900/30 border border-amber-800 text-amber-300 text-sm flex items-center gap-2">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>Bu dönem kilitli. Düzenleme yapılabilmesi için kilidi açmanız gerekmektedir.</span>
        </div>
      )}

      {!isLocked && (
        <div className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 text-xs">
          💡 İpucu: Herhangi bir gün hücresine tıklayarak İzin / Tatil / Mazeret durumu atayabilirsiniz.
          Onaylama için ✓ simgesine tıklayın.
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Mobile scroll hint */}
      <div className="sm:hidden flex items-center justify-between px-3 py-1.5 rounded-lg bg-blue-950/40 border border-blue-900/50 text-[11px] text-blue-300">
        <span>👉 Günleri görmek için tabloyu sağa kaydırın</span>
        <span className="font-mono text-[10px] text-blue-400 font-bold">1 - {days.length} Gün</span>
      </div>

      {/* Matrix table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto touch-pan-x overscroll-x-contain pb-2">
          <table className="text-xs border-collapse w-full">
            {/* Header */}
            <thead>
              <tr className="bg-slate-900 border-b border-slate-700">
                <th className="sticky left-0 z-20 bg-slate-900 px-2 sm:px-3 py-2.5 sm:py-3 text-left text-slate-400 font-semibold whitespace-nowrap border-r border-slate-700 min-w-32 sm:min-w-48">
                  Personel
                </th>
                <th className="sm:sticky sm:left-48 z-10 bg-slate-900 px-2 py-2.5 sm:py-3 text-center text-slate-400 font-semibold border-r border-slate-700 whitespace-nowrap">
                  Görev Yeri
                </th>
                {days.map((day) => {
                  const d = new Date(day);
                  const dow = DOW[d.getUTCDay()];
                  const weekend = isWeekend(day);
                  const holiday = holidayMap.get(day.slice(0, 10));
                  return (
                    <th
                      key={day}
                      className={clsx(
                        "px-0 py-2 text-center font-medium border-r border-slate-800/50 w-10",
                        holiday
                          ? "text-purple-400 bg-purple-900/20"
                          : weekend
                          ? "text-slate-600 bg-slate-900/50"
                          : "text-slate-400"
                      )}
                      title={holiday ? `🎌 ${holiday.name} (${holiday.type === "HALF_DAY" ? "Yarım Gün" : "Tam Gün"})` : undefined}
                    >
                      <div>{d.getUTCDate()}</div>
                      <div className={clsx("text-[9px]", holiday ? "text-purple-500" : weekend ? "text-slate-700" : "text-slate-600")}>
                        {holiday ? "T" : dow}
                      </div>
                    </th>
                  );
                })}
                <th className="px-3 py-3 text-center text-slate-400 font-semibold border-l border-slate-700 whitespace-nowrap">
                  Çalışma
                </th>
                <th className="px-3 py-3 text-center text-slate-400 font-semibold whitespace-nowrap">
                  FM
                </th>
                <th className="px-3 py-3 text-center text-slate-400 font-semibold whitespace-nowrap">
                  Onay
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 5} className="text-center py-12 text-slate-500">
                    Bu filtre için personel bulunamadı.
                  </td>
                </tr>
              ) : (
                employees.map((emp, idx) => {
                  const empDayMap = dayMap.get(emp.id);
                  let totalWorkedDays    = 0;
                  let totalWorkedMinutes = 0;
                  let totalOvertimeMinutes = 0;
                  let pendingApprovals   = 0;
                  let approvedCount      = 0;

                  const dayEntries = days.map((day) => {
                    const dateKey = day.slice(0, 10);
                    return { day, attendance: empDayMap?.get(dateKey) };
                  });

                  dayEntries.forEach(({ attendance }) => {
                    if (attendance?.status === "PRESENT" || attendance?.status === "HALF_DAY") {
                      totalWorkedDays += attendance.status === "HALF_DAY" ? 0.5 : 1;
                      totalWorkedMinutes += attendance.workedMinutes;
                      totalOvertimeMinutes += attendance.overtimeMinutes;
                    }
                    if (attendance) {
                      if (attendance.isApproved) approvedCount++;
                      else pendingApprovals++;
                    }
                  });

                  return (
                    <tr
                      key={emp.id}
                      className={clsx(
                        "border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group",
                        idx % 2 === 0 ? "" : "bg-slate-900/30"
                      )}
                    >
                      {/* Employee name — sticky left-0 */}
                      <td className="sticky left-0 group-hover:bg-slate-800 px-2 sm:px-3 py-2 border-r border-slate-700 whitespace-nowrap z-[15]"
                        style={{ backgroundColor: idx % 2 === 0 ? "#1e293b" : "#172033" }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600/40 to-violet-600/40 border border-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-400 flex-shrink-0">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <div className="max-w-[85px] sm:max-w-none truncate">
                            <p className="text-slate-200 font-medium leading-tight text-xs truncate">
                              {emp.lastName} {emp.firstName}
                            </p>
                            <p className="text-slate-500 text-[10px]">#{emp.employeeNo}</p>
                          </div>
                        </div>
                      </td>

                      {/* Workplace — only sticky on sm+ so table scrolls freely on mobile */}
                      <td className="sm:sticky sm:left-48 px-2 py-2 text-center border-r border-slate-700 whitespace-nowrap text-slate-400 z-[10] text-xs"
                        style={{ backgroundColor: idx % 2 === 0 ? "#1e293b" : "#172033" }}
                      >
                        {emp.workplaceName}
                      </td>

                      {/* Day cells */}
                      {dayEntries.map(({ day, attendance }) => {
                        const dateKey = day.slice(0, 10);
                        const weekend = isWeekend(day);
                        const holiday = holidayMap.get(dateKey);

                        let cellContent = null;
                        let cellClass = "";

                        if (holiday && !attendance) {
                          // Public holiday cell with no explicit record — show holiday badge
                          const isHalf = holiday.type === "HALF_DAY";
                          cellContent = (
                            <span title={`🎌 ${holiday.name}`}>
                              {isHalf ? "Y" : "T"}
                            </span>
                          );
                          cellClass = isHalf
                            ? "bg-purple-900/20 text-purple-400 border border-purple-800/30"
                            : "bg-purple-900/30 text-purple-300 border border-purple-700/40";
                        } else if (weekend && !attendance) {
                          cellContent = <span className="text-slate-700">T</span>;
                          cellClass = "bg-slate-900/30";
                        } else if (attendance) {
                          const style = STATUS_CELL[attendance.status];
                          if (attendance.status === "PRESENT") {
                            cellContent = (
                              <span title={`${formatMinutes(attendance.workedMinutes)} çalışma${attendance.overtimeMinutes > 0 ? ` (+${formatMinutes(attendance.overtimeMinutes)} FM)` : ""}`}>
                                {formatMinutes(attendance.workedMinutes)}
                              </span>
                            );
                          } else {
                            cellContent = <span>{style?.label ?? "?"}</span>;
                          }
                          cellClass = clsx("border", style?.className);
                        }

                        return (
                          <td
                            key={day}
                            className={clsx(
                              "py-1.5 text-center font-mono border-r border-slate-800/30 w-10 cursor-pointer select-none",
                              cellClass,
                              !isLocked && "hover:opacity-80 hover:ring-1 hover:ring-blue-500/50"
                            )}
                            title={holiday && !attendance ? `🎌 ${holiday.name} — Tıkla: Manuel atama yap` : !isLocked ? "Tıkla: Çalıştı / İzin durumu ata" : undefined}
                            onClick={(e) => handleCellClick(e, attendance, emp.id, day)}
                          >
                            {cellContent}
                          </td>
                        );
                      })}

                      {/* Summary */}
                      <td className="px-3 py-2 text-center border-l border-slate-700 font-mono text-slate-300 whitespace-nowrap">
                        <div>{totalWorkedDays}g</div>
                        <div className="text-emerald-400">{formatMinutes(totalWorkedMinutes)}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-orange-400 whitespace-nowrap">
                        {totalOvertimeMinutes > 0 ? formatMinutes(totalOvertimeMinutes) : "—"}
                      </td>
                      {/* Approval column — shows approved/pending count and toggle */}
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 text-[10px]">
                          <span className="text-emerald-400">{approvedCount}✓</span>
                          {pendingApprovals > 0 && (
                            <span className="text-yellow-400">{pendingApprovals}⏳</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_CELL).map(([key, val]) => (
          <div key={key} className={clsx("flex items-center gap-1.5 px-2 py-1 rounded border", val.className)}>
            <span className="font-bold">{val.label}</span>
            <span className="opacity-70">{val.fullLabel}</span>
          </div>
        ))}
      </div>

      {/* Cell context menu */}
      {cellMenu && (
        <div
          className="fixed z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl shadow-black/70 py-2.5 min-w-56 text-sm"
          style={{ top: cellMenu.y + 4, left: Math.min(cellMenu.x, window.innerWidth - 240) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pb-2 text-xs text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-700/80 mb-2 flex items-center justify-between">
            <span>{cellMenu.workDate}</span>
            {cellMenu.currentStatus && (
              <span className="text-[10px] font-normal text-slate-500 lowercase">
                ({STATUS_CELL[cellMenu.currentStatus]?.fullLabel ?? cellMenu.currentStatus})
              </span>
            )}
          </div>

          {/* 1. ÇALIŞTI / NORMAL ÇALIŞMA (Tek tıkla doğrudan atama) */}
          <div className="px-2 mb-2">
            <button
              onClick={() => handleStatusSet("PRESENT", 480)}
              className={clsx(
                "w-full text-left px-3 py-2 rounded-lg font-medium transition-all flex items-center justify-between group",
                cellMenu.currentStatus === "PRESENT"
                  ? "bg-emerald-950/70 border border-emerald-600/50 text-emerald-300"
                  : "bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-200"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-xs">
                  ✓
                </span>
                <span>Çalıştı (Normal — 8s)</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 opacity-80 group-hover:opacity-100">
                480 dk
              </span>
            </button>

            {/* Hızlı saat presets */}
            <div className="flex items-center gap-1 mt-1.5 px-1">
              <span className="text-[10px] text-slate-500 mr-1">Saat:</span>
              {[
                { label: "4s", mins: 240 },
                { label: "7.5s", mins: 450 },
                { label: "8s", mins: 480 },
                { label: "9s", mins: 540 },
                { label: "10s", mins: 600 },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => handleStatusSet("PRESENT", p.mins)}
                  title={`${p.label} (${p.mins} dk) olarak kaydet`}
                  className={clsx(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors border",
                    cellMenu.currentStatus === "PRESENT" && cellMenu.workedMinutes === p.mins
                      ? "bg-emerald-500 text-slate-950 font-bold border-emerald-400"
                      : "bg-slate-700/60 hover:bg-slate-700 text-slate-300 border-slate-600/60"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-700/70 my-1" />

          {/* 2. İZİN / DİĞER DURUMLAR */}
          <div className="px-1 space-y-0.5">
            {SETTABLE_STATUSES.map((st) => {
              const cfg = STATUS_CELL[st];
              const isActive = cellMenu.currentStatus === st;
              return (
                <button
                  key={st}
                  onClick={() => handleStatusSet(st)}
                  className={clsx(
                    "w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2",
                    isActive ? "text-white bg-slate-700 font-semibold" : "text-slate-300 hover:bg-slate-700/50"
                  )}
                >
                  <span className={clsx("w-5 text-center font-bold", cfg?.className?.split(" ")[1])}>
                    {cfg?.label ?? "•"}
                  </span>
                  <span>{cfg?.fullLabel ?? st}</span>
                  {isActive && <span className="ml-auto text-blue-400 text-[10px]">✓ Seçili</span>}
                </button>
              );
            })}
          </div>

          {/* 3. ONAY VE SİLME AKSİYONLARI */}
          {cellMenu.dayId && (() => {
            const dayRecord = localDays.find((d) => d.id === cellMenu.dayId);
            if (!dayRecord) return null;
            return (
              <>
                <div className="border-t border-slate-700/70 my-1.5" />
                <div className="px-1 space-y-1">
                  <button
                    onClick={() => {
                      handleApproveToggle(cellMenu.dayId!, dayRecord.isApproved);
                      setCellMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-700/60 transition-colors flex items-center gap-2 text-xs"
                  >
                    {dayRecord.isApproved ? (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-yellow-300">Günün Onayını Geri Al</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Günü Onayla</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteDayRecord(cellMenu.dayId!)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-red-400 transition-colors flex items-center gap-2 text-xs"
                  >
                    <span className="w-3.5 text-center font-bold">✕</span>
                    <span>Kaydı Temizle (Boş Bırak)</span>
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
