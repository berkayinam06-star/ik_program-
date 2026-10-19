"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock4, Loader2, Plus } from "lucide-react";

interface Employee {
  id: string;
  label: string;
}

interface ShiftFormProps {
  employees: Employee[];
  defaultEmployeeId?: string;
  year: number;
  month: number;
}

export function ShiftForm({ employees, defaultEmployeeId, year, month }: ShiftFormProps) {
  const router = useRouter();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

  const [employeeId, setEmployeeId]         = useState(defaultEmployeeId ?? (employees[0]?.id ?? ""));
  const [workDate, setWorkDate]             = useState(today);
  const [plannedStartTime, setStartTime]    = useState("08:00");
  const [plannedEndTime, setEndTime]        = useState("17:00");
  const [breakPolicyMinutes, setBreakMins]  = useState("60");
  const [error, setError]                   = useState<string | null>(null);
  const [success, setSuccess]               = useState(false);
  const [isPending, startTransition]        = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            workDate,
            plannedStartTime,
            plannedEndTime,
            breakPolicyMinutes: parseInt(breakPolicyMinutes, 10) || 0,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Hata oluştu");
        }

        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Hata oluştu");
      }
    });
  };

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <Clock4 className="w-4 h-4 text-blue-400" />
        Vardiya Ata / Güncelle
      </h3>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-900/30 border border-emerald-800 text-emerald-300 text-sm">
          ✓ Vardiya kaydedildi.
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Employee */}
        <div className="xl:col-span-2">
          <label className="label" htmlFor="shift-emp">Personel *</label>
          <select
            id="shift-emp"
            className="select"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
          >
            <option value="">Seçiniz…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.label}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="label" htmlFor="shift-date">Tarih *</label>
          <input
            id="shift-date"
            type="date"
            className="input"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            required
          />
        </div>

        {/* Start Time */}
        <div>
          <label className="label" htmlFor="shift-start">Planlanan Giriş *</label>
          <input
            id="shift-start"
            type="time"
            className="input"
            value={plannedStartTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>

        {/* End Time */}
        <div>
          <label className="label" htmlFor="shift-end">Planlanan Çıkış *</label>
          <input
            id="shift-end"
            type="time"
            className="input"
            value={plannedEndTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>

        {/* Break */}
        <div>
          <label className="label" htmlFor="shift-break">Mola (dk)</label>
          <input
            id="shift-break"
            type="number"
            min="0"
            max="480"
            className="input"
            value={breakPolicyMinutes}
            onChange={(e) => setBreakMins(e.target.value)}
          />
        </div>

        {/* Submit */}
        <div className="xl:col-span-6 flex justify-end">
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor…</>
            ) : (
              <><Plus className="w-4 h-4" /> Vardiya Kaydet</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
