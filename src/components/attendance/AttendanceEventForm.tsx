"use client";

import { useState, useTransition } from "react";
import { LogIn, LogOut, Loader2, Trash2 } from "lucide-react";
import { toIstanbulTimeString } from "@/lib/timezone";

interface Event {
  id: string;
  occurredAt: string | Date;
  type: "IN" | "OUT";
  source: string;
  note: string | null;
}

interface AttendanceEventFormProps {
  employees: { id: string; firstName: string; lastName: string; employeeNo: string }[];
  defaultEmployeeId?: string;
  defaultDate?: string;
  existingEvents?: Event[];
  onSaved?: () => void;
}

export function AttendanceEventForm({
  employees,
  defaultEmployeeId,
  defaultDate,
  existingEvents = [],
  onSaved,
}: AttendanceEventFormProps) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? (employees[0]?.id ?? ""));
  const [date, setDate]             = useState(defaultDate ?? today);
  const [time, setTime]             = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [type, setType]   = useState<"IN" | "OUT">("IN");
  const [note, setNote]   = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const events = existingEvents.filter((e) => e !== undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/attendance/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, date, time, type, note }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Bir hata oluştu");
        }

        setNote("");
        onSaved?.();

        // Refresh page to show new events
        window.location.reload();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Bir hata oluştu");
      }
    });
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`/api/attendance/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Silinemedi");
      }
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Silinemedi");
    }
  };

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Giriş / Çıkış Kaydı Ekle</h3>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <label className="label" htmlFor="emp-select">Personel *</label>
            <select
              id="emp-select"
              className="select"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value="">Seçiniz…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  [{emp.employeeNo}] {emp.lastName} {emp.firstName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="event-date">Tarih *</label>
            <input
              id="event-date"
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="event-time">Saat *</label>
            <input
              id="event-time"
              type="time"
              className="input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>

          {/* Type toggle */}
          <div>
            <label className="label">Hareket Tipi *</label>
            <div className="flex rounded-lg overflow-hidden border border-slate-600">
              <button
                type="button"
                onClick={() => setType("IN")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-all ${
                  type === "IN"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                <LogIn className="w-4 h-4" />
                Giriş
              </button>
              <button
                type="button"
                onClick={() => setType("OUT")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-all ${
                  type === "OUT"
                    ? "bg-red-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                <LogOut className="w-4 h-4" />
                Çıkış
              </button>
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-2">
            <label className="label" htmlFor="event-note">Not (İsteğe Bağlı)</label>
            <input
              id="event-note"
              type="text"
              className="input"
              placeholder="Açıklama veya neden…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button
              type="submit"
              className="btn-primary"
              disabled={isPending}
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor…</>
              ) : (
                <><LogIn className="w-4 h-4" /> Kaydı Ekle</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Existing events */}
      {events.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300">
              Seçili Günün Hareketleri ({events.length} kayıt)
            </h3>
          </div>
          <div className="divide-y divide-slate-700/50">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-4 px-5 py-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    event.type === "IN"
                      ? "bg-emerald-500/20 border border-emerald-500/40"
                      : "bg-red-500/20 border border-red-500/40"
                  }`}
                >
                  {event.type === "IN" ? (
                    <LogIn className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <LogOut className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${event.type === "IN" ? "text-emerald-400" : "text-red-400"}`}>
                      {event.type === "IN" ? "GİRİŞ" : "ÇIKIŞ"}
                    </span>
                    <span className="text-lg font-mono text-slate-100">
                      {toIstanbulTimeString(new Date(event.occurredAt))}
                    </span>
                  </div>
                  {event.note && (
                    <p className="text-xs text-slate-500 mt-0.5">{event.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 uppercase">{event.source}</span>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="btn-icon btn-sm text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
