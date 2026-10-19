"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { AttendanceDayStatus } from "@prisma/client";

interface Props {
  dayId?: string | null;
  employeeId: string;
  workDate: string;
  currentStatus?: AttendanceDayStatus | string;
  isApproved: boolean;
}

const STATUS_OPTIONS: { value: AttendanceDayStatus; label: string }[] = [
  { value: "PRESENT",        label: "✅ Çalıştı (Normal)" },
  { value: "ANNUAL_LEAVE",   label: "🏖️ Yıllık İzin" },
  { value: "SICK_LEAVE",     label: "🏥 Hastalık / Rapor" },
  { value: "EXCUSED",        label: "📋 Mazeret" },
  { value: "HALF_DAY",       label: "🕐 Yarım Gün" },
  { value: "PUBLIC_HOLIDAY", label: "🎉 Resmi Tatil" },
  { value: "REST_DAY",       label: "😴 İstirahat" },
  { value: "ABSENT",         label: "❌ Devamsız" },
];

export function DayStatusManager({
  dayId,
  employeeId,
  workDate,
  currentStatus = "PRESENT",
  isApproved: initialApproved,
}: Props) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<string>(currentStatus);
  const [isApproved, setIsApproved]         = useState<boolean>(initialApproved);
  const [isPending, startTransition]       = useTransition();
  const [error, setError]                   = useState<string | null>(null);
  const [success, setSuccess]               = useState<string | null>(null);

  const handleStatusChange = (newStatus: string) => {
    setSelectedStatus(newStatus);
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        let res: Response;
        if (dayId) {
          res = await fetch(`/api/attendance/days/${dayId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          });
        } else {
          res = await fetch("/api/attendance/days", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId,
              workDate,
              status: newStatus,
            }),
          });
        }

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Durum güncellenemedi");
        }

        setSuccess("Gün durumu kaydedildi");
        router.refresh();
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hata");
      }
    });
  };

  const handleToggleApproval = () => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        let res: Response;
        const targetApproved = !isApproved;

        if (dayId) {
          res = await fetch(`/api/attendance/days/${dayId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isApproved: targetApproved }),
          });
        } else {
          // If no day record yet, upsert one with isApproved
          res = await fetch("/api/attendance/days", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId,
              workDate,
              status: selectedStatus,
              isApproved: targetApproved,
            }),
          });
        }

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Onay işlemi başarısız");
        }

        setIsApproved(targetApproved);
        setSuccess(targetApproved ? "Gün onaylandı" : "Onay geri alındı");
        router.refresh();
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hata");
      }
    });
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Status Selector Dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 whitespace-nowrap font-medium">
          Gün Durumu:
        </label>
        <select
          value={selectedStatus}
          disabled={isPending}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="select text-xs py-1.5 px-3 bg-slate-800 border-slate-700 rounded-lg text-slate-200 focus:ring-1 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Approve / Unapprove Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleApproval}
          disabled={isPending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            isApproved
              ? "bg-amber-900/30 text-amber-300 border-amber-800 hover:bg-amber-900/50"
              : "bg-emerald-900/30 text-emerald-300 border-emerald-800 hover:bg-emerald-900/50"
          }`}
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isApproved ? (
            <>
              <XCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Onayı Geri Al</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Günü Onayla</span>
            </>
          )}
        </button>
      </div>

      {error && <span className="text-xs text-red-400">{error}</span>}
      {success && <span className="text-xs text-emerald-400">{success}</span>}
    </div>
  );
}
