"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck2,
  Plus,
  Trash2,
  X,
  Sun,
  Sunset,
  AlertCircle,
  Loader2,
  CalendarDays,
  Building2,
} from "lucide-react";

interface Holiday {
  id: string;
  companyId: string;
  date: string;
  name: string;
  type: "FULL_DAY" | "HALF_DAY";
  description: string;
}

interface Company {
  id: string;
  name: string;
}

interface HolidaysClientProps {
  companies: Company[];
  selectedCompanyId: string;
  year: number;
  initialHolidays: Holiday[];
}

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function formatDate(isoStr: string) {
  const d = new Date(isoStr);
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const dayName = DAY_NAMES[d.getUTCDay()];
  return `${day} ${month} ${year} ${dayName}`;
}

// Group holidays by month
function groupByMonth(holidays: Holiday[]) {
  const groups: Record<number, Holiday[]> = {};
  for (const h of holidays) {
    const m = new Date(h.date).getUTCMonth();
    if (!groups[m]) groups[m] = [];
    groups[m].push(h);
  }
  return groups;
}

// Generate Turkish national holidays for a given year
function turkishNationalHolidays(year: number) {
  return [
    { date: `${year}-01-01`, name: "Yılbaşı", type: "FULL_DAY" as const },
    { date: `${year}-04-23`, name: "Ulusal Egemenlik ve Çocuk Bayramı", type: "FULL_DAY" as const },
    { date: `${year}-05-01`, name: "Emek ve Dayanışma Bayramı", type: "FULL_DAY" as const },
    { date: `${year}-05-19`, name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", type: "FULL_DAY" as const },
    { date: `${year}-07-15`, name: "Demokrasi ve Millî Birlik Günü", type: "FULL_DAY" as const },
    { date: `${year}-08-30`, name: "Zafer Bayramı", type: "FULL_DAY" as const },
    { date: `${year}-10-28`, name: "Cumhuriyet Bayramı (Yarım Gün)", type: "HALF_DAY" as const },
    { date: `${year}-10-29`, name: "Cumhuriyet Bayramı", type: "FULL_DAY" as const },
  ];
}

export function HolidaysClient({
  companies,
  selectedCompanyId,
  year,
  initialHolidays,
}: HolidaysClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    date: "",
    name: "",
    type: "FULL_DAY" as "FULL_DAY" | "HALF_DAY",
    description: "",
  });

  const grouped = groupByMonth(holidays);
  const selectedYear = year;
  const availableYears = [selectedYear - 1, selectedYear, selectedYear + 1, selectedYear + 2];

  function navigate(newCompanyId?: string, newYear?: number) {
    const companyId = newCompanyId ?? selectedCompanyId;
    const yr = newYear ?? selectedYear;
    startTransition(() => {
      router.push(`/holidays?companyId=${companyId}&year=${yr}`);
    });
  }

  async function handleSave() {
    setError(null);
    if (!form.date || !form.name.trim()) {
      setError("Tarih ve tatil adı zorunludur.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          date: form.date,
          name: form.name.trim(),
          type: form.type,
          description: form.description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kaydedilemedi");
        return;
      }
      setHolidays((prev) =>
        [...prev, { ...data, date: data.date }].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      );
      setShowModal(false);
      setForm({ date: "", name: "", type: "FULL_DAY", description: "" });
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Silinemedi");
        return;
      }
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleImportNational() {
    const toImport = turkishNationalHolidays(selectedYear);
    setSaving(true);
    let addedCount = 0;
    for (const h of toImport) {
      const alreadyExists = holidays.some((existing) =>
        existing.date.startsWith(h.date)
      );
      if (alreadyExists) continue;
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          date: h.date,
          name: h.name,
          type: h.type,
          description: "",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setHolidays((prev) =>
          [...prev, { ...data }].sort((a, b) => a.date.localeCompare(b.date))
        );
        addedCount++;
      }
    }
    setSaving(false);
    if (addedCount > 0) {
      alert(`${addedCount} ulusal tatil başarıyla eklendi.`);
    } else {
      alert("Tüm ulusal tatiller zaten tanımlı.");
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-w-0">
      {/* LEFT: Year/Company Selector + Calendar Overview */}
      <div className="flex-1 min-w-0">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 mb-6">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              className="bg-transparent text-slate-200 text-sm outline-none pr-2"
              value={selectedCompanyId}
              onChange={(e) => navigate(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <select
              className="bg-transparent text-slate-200 text-sm outline-none pr-2"
              value={selectedYear}
              onChange={(e) => navigate(undefined, parseInt(e.target.value))}
            >
              {availableYears.map((y) => (
                <option key={y} value={y} className="bg-slate-900">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          {/* Import national */}
          <button
            onClick={handleImportNational}
            disabled={saving || isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarCheck2 className="w-4 h-4 text-blue-400" />
            )}
            Türkiye Ulusal Tatillerini Yükle
          </button>

          <button
            onClick={() => {
              setShowModal(true);
              setError(null);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            Tatil Ekle
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">Toplam Tatil Günü</p>
            <p className="text-2xl font-black text-white">{holidays.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">Tam Gün Tatil</p>
            <p className="text-2xl font-black text-emerald-400">
              {holidays.filter((h) => h.type === "FULL_DAY").length}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">Yarım Gün Tatil</p>
            <p className="text-2xl font-black text-amber-400">
              {holidays.filter((h) => h.type === "HALF_DAY").length}
            </p>
          </div>
        </div>

        {/* Month-grouped holiday list */}
        {holidays.length === 0 ? (
          <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-12 text-center">
            <CalendarCheck2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">
              {selectedYear} yılı için henüz resmi tatil tanımlanmamış.
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Sağdaki "Tatil Ekle" butonu ile başlayın veya Türkiye ulusal tatillerini toplu yükleyin.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from({ length: 12 }, (_, i) => i)
              .filter((m) => grouped[m]?.length > 0)
              .map((m) => (
                <div key={m} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/50 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <h3 className="text-sm font-bold text-white">
                      {MONTHS[m]} {selectedYear}
                    </h3>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                      {grouped[m].length} tatil
                    </span>
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {grouped[m].map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-800/30 transition-colors group"
                      >
                        {/* Type icon */}
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            h.type === "FULL_DAY"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
                          {h.type === "FULL_DAY" ? (
                            <Sun className="w-4 h-4" />
                          ) : (
                            <Sunset className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white">{h.name}</span>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                h.type === "FULL_DAY"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              }`}
                            >
                              {h.type === "FULL_DAY" ? "Tam Gün" : "Yarım Gün"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{formatDate(h.date)}</p>
                          {h.description && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{h.description}</p>
                          )}
                        </div>

                        <button
                          onClick={() => handleDelete(h.id)}
                          disabled={deletingId === h.id}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Tatili sil"
                        >
                          {deletingId === h.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Quick add form (always visible on large screens) */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <div className="bg-slate-900 border border-slate-800 rounded-xl sticky top-6">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Yeni Resmi Tatil Ekle
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tarihi, adı ve türü seçip kaydedin
            </p>
          </div>

          <div className="p-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Tatil Tarihi *
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Tatil Adı *
              </label>
              <input
                type="text"
                placeholder="örn. Kurban Bayramı"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 placeholder:text-slate-600"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Tatil Türü
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: "FULL_DAY" }))}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.type === "FULL_DAY"
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  Tam Gün
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: "HALF_DAY" }))}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.type === "HALF_DAY"
                      ? "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/20"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <Sunset className="w-3.5 h-3.5" />
                  Yarım Gün
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Açıklama (opsiyonel)
              </label>
              <textarea
                rows={2}
                placeholder="Ek notlar..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 placeholder:text-slate-600 resize-none"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !form.date || !form.name.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-emerald-500/20"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Tatili Kaydet
            </button>

            <div className="pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-600 leading-relaxed">
                Eklediğiniz günler aylık puantajda otomatik olarak{" "}
                <span className="text-purple-400 font-medium">Resmi Tatil</span> olarak
                işaretlenebilir ve iş günü sayısına dahil edilmez.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 lg:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">Resmi Tatil Ekle</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5"
              />
              <input
                type="text"
                placeholder="Tatil adı"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setForm((f) => ({ ...f, type: "FULL_DAY" }))}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                    form.type === "FULL_DAY"
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  Tam Gün
                </button>
                <button
                  onClick={() => setForm((f) => ({ ...f, type: "HALF_DAY" }))}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                    form.type === "HALF_DAY"
                      ? "bg-amber-600 border-amber-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  Yarım Gün
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-all"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
