"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  X,
  Check,
  Clock,
  LogIn,
  LogOut,
  AlertTriangle,
  Search,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import clsx from "clsx";

interface EventRow {
  id: string;
  occurredAt: string;
  workDate: string;
  type: "IN" | "OUT";
  source: "MANUAL" | "DEVICE";
  note: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
    workplace: { name: string };
  };
}

interface EditState {
  id: string;
  date: string;   // "YYYY-MM-DD"
  time: string;   // "HH:MM"
  type: "IN" | "OUT";
  note: string;
}

function toIstanbul(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInput(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    timeZone: "Europe/Istanbul",
  });
}

function toTimeInput(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function EventsTable({ events }: { events: EventRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [editState, setEditState] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  /* ── Filter ───────────────────────────────────────────────── */
  const filtered = events.filter((e) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      e.employee.firstName.toLowerCase().includes(q) ||
      e.employee.lastName.toLowerCase().includes(q) ||
      e.employee.employeeNo.includes(q) ||
      e.employee.workplace.name.toLowerCase().includes(q);
    const matchesType = filterType === "ALL" || e.type === filterType;
    return matchesSearch && matchesType;
  });

  /* ── Open edit ─────────────────────────────────────────────── */
  const openEdit = (e: EventRow) => {
    setEditState({
      id: e.id,
      date: toDateInput(e.occurredAt),
      time: toTimeInput(e.occurredAt),
      type: e.type,
      note: e.note ?? "",
    });
  };

  /* ── Save edit ─────────────────────────────────────────────── */
  const saveEdit = async () => {
    if (!editState) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/attendance/events/${editState.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editState.date,
          time: editState.time,
          type: editState.type,
          note: editState.note,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error ?? "Güncelleme başarısız", false);
        return;
      }
      showToast("Kayıt güncellendi ✓", true);
      setEditState(null);
      refresh();
    } catch {
      showToast("Bağlantı hatası", false);
    } finally {
      setBusy(false);
    }
  };

  /* ── Delete ────────────────────────────────────────────────── */
  const confirmDelete = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/attendance/events/${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error ?? "Silme başarısız", false);
        return;
      }
      showToast("Kayıt silindi ✓", true);
      setDeleteId(null);
      refresh();
    } catch {
      showToast("Bağlantı hatası", false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && (
        <div
          className={clsx(
            "fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border animate-fade-in",
            toast.ok
              ? "bg-emerald-900/90 border-emerald-700 text-emerald-200"
              : "bg-red-900/90 border-red-700 text-red-200"
          )}
        >
          {toast.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────── */}
      {editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md p-6 space-y-5 shadow-2xl border-slate-600">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">Kaydı Düzenle</h2>
              <button
                onClick={() => setEditState(null)}
                className="btn-icon btn-secondary btn-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Tarih</label>
                <input
                  type="date"
                  className="input"
                  value={editState.date}
                  onChange={(e) => setEditState((s) => s && { ...s, date: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Saat</label>
                <input
                  type="time"
                  className="input"
                  value={editState.time}
                  onChange={(e) => setEditState((s) => s && { ...s, time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Tip</label>
              <div className="flex gap-3">
                {(["IN", "OUT"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEditState((s) => s && { ...s, type: t })}
                    className={clsx(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-all",
                      editState.type === t
                        ? t === "IN"
                          ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-300"
                          : "bg-red-600/20 border-red-500/50 text-red-300"
                        : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"
                    )}
                  >
                    {t === "IN" ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                    {t === "IN" ? "Giriş" : "Çıkış"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Not (isteğe bağlı)</label>
              <input
                type="text"
                className="input"
                placeholder="Açıklama..."
                value={editState.note}
                onChange={(e) => setEditState((s) => s && { ...s, note: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setEditState(null)}
                disabled={busy}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={saveEdit}
                disabled={busy}
              >
                {busy ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-sm p-6 space-y-4 shadow-2xl border-slate-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-900/40 border border-red-700/50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-100">Kaydı Sil</h2>
                <p className="text-xs text-slate-400 mt-0.5">Bu işlem geri alınamaz.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Bu devam kaydını silmek istediğinize emin misiniz? Günlük puantaj otomatik yeniden hesaplanacaktır.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setDeleteId(null)}
                disabled={busy}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn-danger flex-1"
                onClick={confirmDelete}
                disabled={busy}
              >
                {busy ? "Siliniyor..." : "Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <SlidersHorizontal className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Personel veya görev yeri ara..."
            className="input pl-8 py-1.5 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {(["ALL", "IN", "OUT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                filterType === t
                  ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
              )}
            >
              {t === "ALL" ? "Tümü" : t === "IN" ? "Giriş" : "Çıkış"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          className="btn-secondary btn-sm gap-1.5"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", isPending && "animate-spin")} />
          Yenile
        </button>
        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} kayıt
        </span>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
            <Clock className="w-10 h-10 opacity-30" />
            <p className="text-sm">Henüz kayıt bulunamadı</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Personel</th>
                  <th>Görev Yeri</th>
                  <th>Tarih &amp; Saat</th>
                  <th>Tip</th>
                  <th>Kaynak</th>
                  <th>Not</th>
                  <th className="text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => (
                  <tr key={event.id}>
                    {/* Personel */}
                    <td>
                      <div>
                        <p className="font-medium text-slate-100">
                          {event.employee.firstName} {event.employee.lastName}
                        </p>
                        <p className="text-xs text-slate-500">#{event.employee.employeeNo}</p>
                      </div>
                    </td>

                    {/* Görev Yeri */}
                    <td>
                      <span className="text-slate-300 text-xs">
                        {event.employee.workplace.name}
                      </span>
                    </td>

                    {/* Tarih & Saat */}
                    <td>
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="font-mono text-sm">{toIstanbul(event.occurredAt)}</span>
                      </div>
                    </td>

                    {/* Tip */}
                    <td>
                      {event.type === "IN" ? (
                        <span className="badge badge-green gap-1">
                          <LogIn className="w-3 h-3" /> Giriş
                        </span>
                      ) : (
                        <span className="badge badge-red gap-1">
                          <LogOut className="w-3 h-3" /> Çıkış
                        </span>
                      )}
                    </td>

                    {/* Kaynak */}
                    <td>
                      <span className={clsx("badge", event.source === "MANUAL" ? "badge-yellow" : "badge-blue")}>
                        {event.source === "MANUAL" ? "Manuel" : "Cihaz"}
                      </span>
                    </td>

                    {/* Not */}
                    <td>
                      <span className="text-xs text-slate-400 max-w-[120px] truncate block">
                        {event.note || "—"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(event)}
                          className="btn-icon btn-secondary btn-sm hover:border-blue-500/50 hover:text-blue-300 transition-all"
                          title="Giriş/Çıkış Saatini Düzenle"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(event.id)}
                          className="btn-icon btn-secondary btn-sm hover:border-red-500/50 hover:text-red-400 transition-all"
                          title="Hareketi Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
