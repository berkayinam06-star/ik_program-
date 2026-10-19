"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Loader2 } from "lucide-react";

interface EmployeeFormProps {
  companies:  { id: string; name: string }[];
  workplaces: { id: string; name: string; companyId: string }[];
  initialData?: {
    id:          string;
    companyId:   string;
    workplaceId: string;
    employeeNo:  string;
    firstName:   string;
    lastName:    string;
    startDate:   string;
    endDate:     string | null;
    status:      string;
    position:    string | null;
  };
}

const STATUS_OPTIONS = [
  { value: "ACTIVE",   label: "Aktif"  },
  { value: "PASSIVE",  label: "Pasif"  },
  { value: "ON_LEAVE", label: "İzinli" },
];

export function EmployeeForm({ companies, workplaces, initialData }: EmployeeFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [formData, setFormData] = useState({
    companyId:   initialData?.companyId   ?? (companies[0]?.id ?? ""),
    workplaceId: initialData?.workplaceId ?? "",
    employeeNo:  initialData?.employeeNo  ?? "",
    firstName:   initialData?.firstName   ?? "",
    lastName:    initialData?.lastName    ?? "",
    position:    initialData?.position    ?? "",
    startDate:   initialData?.startDate   ?? new Date().toISOString().slice(0, 10),
    endDate:     initialData?.endDate     ?? "",
    status:      initialData?.status      ?? "ACTIVE",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const filteredWorkplaces = workplaces.filter(
    (w) => w.companyId === formData.companyId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url    = isEdit ? `/api/employees/${initialData.id}` : "/api/employees";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          endDate: formData.endDate || null,
          position: formData.position || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Bir hata oluştu");
      }

      router.push("/employees");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData((p) => ({ ...p, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-2xl">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-700 mb-6">
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Users className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            {isEdit ? "Personeli Düzenle" : "Yeni Personel"}
          </h2>
          <p className="text-xs text-slate-400">* ile işaretli alanlar zorunludur</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Company */}
        <div>
          <label className="label" htmlFor="companyId">Şirket *</label>
          <select
            id="companyId"
            className="select"
            value={formData.companyId}
            onChange={(e) => {
              setFormData((p) => ({ ...p, companyId: e.target.value, workplaceId: "" }));
            }}
            required
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Workplace */}
        <div>
          <label className="label" htmlFor="workplaceId">Görev Yeri *</label>
          <select
            id="workplaceId"
            className="select"
            value={formData.workplaceId}
            onChange={set("workplaceId")}
            required
          >
            <option value="">Seçiniz…</option>
            {filteredWorkplaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Employee No */}
        <div>
          <label className="label" htmlFor="employeeNo">Sicil No *</label>
          <input
            id="employeeNo"
            type="text"
            className="input"
            placeholder="Örn: 00123"
            value={formData.employeeNo}
            onChange={set("employeeNo")}
            required
          />
        </div>

        {/* Position */}
        <div>
          <label className="label" htmlFor="position">Pozisyon / Unvan</label>
          <input
            id="position"
            type="text"
            className="input"
            placeholder="Örn: Mühendis"
            value={formData.position}
            onChange={set("position")}
          />
        </div>

        {/* First Name */}
        <div>
          <label className="label" htmlFor="firstName">Ad *</label>
          <input
            id="firstName"
            type="text"
            className="input"
            placeholder="Adı"
            value={formData.firstName}
            onChange={set("firstName")}
            required
          />
        </div>

        {/* Last Name */}
        <div>
          <label className="label" htmlFor="lastName">Soyad *</label>
          <input
            id="lastName"
            type="text"
            className="input"
            placeholder="Soyadı"
            value={formData.lastName}
            onChange={set("lastName")}
            required
          />
        </div>

        {/* Start Date */}
        <div>
          <label className="label" htmlFor="startDate">İşe Giriş Tarihi *</label>
          <input
            id="startDate"
            type="date"
            className="input"
            value={formData.startDate}
            onChange={set("startDate")}
            required
          />
        </div>

        {/* End Date */}
        <div>
          <label className="label" htmlFor="endDate">İşten Çıkış Tarihi</label>
          <input
            id="endDate"
            type="date"
            className="input"
            value={formData.endDate}
            onChange={set("endDate")}
          />
        </div>

        {/* Status */}
        <div>
          <label className="label" htmlFor="status">Durum *</label>
          <select
            id="status"
            className="select"
            value={formData.status}
            onChange={set("status")}
            required
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t border-slate-700">
        {isEdit && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Bu personeli silmek (arşivlemek) istediğinizden emin misiniz?\nGeçmiş puantaj ve devam kayıtları saklanacak, ancak personel aktif listeden kaldırılacaktır.")) return;
              setLoading(true);
              try {
                const res = await fetch(`/api/employees/${initialData.id}`, { method: "DELETE" });
                if (!res.ok) {
                  const d = await res.json();
                  throw new Error(d.error ?? "Silinemedi");
                }
                router.push("/employees");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Silinemedi");
                setLoading(false);
              }
            }}
            className="btn-danger btn-sm"
            disabled={loading}
          >
            Personeli Sil
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary min-w-24"
          disabled={loading}
        >
          İptal
        </button>
        <button
          type="submit"
          className="btn-primary min-w-32"
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor…</>
          ) : (
            isEdit ? "Güncelle" : "Personel Ekle"
          )}
        </button>
      </div>
    </form>
  );
}
