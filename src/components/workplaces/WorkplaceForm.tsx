"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";

interface WorkplaceFormProps {
  companies: { id: string; name: string }[];
  initialData?: {
    id: string;
    companyId: string;
    name: string;
    sgkRegistrationNo: string | null;
  };
}

export function WorkplaceForm({ companies, initialData }: WorkplaceFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [formData, setFormData] = useState({
    companyId:         initialData?.companyId ?? (companies[0]?.id ?? ""),
    name:              initialData?.name ?? "",
    sgkRegistrationNo: initialData?.sgkRegistrationNo ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url    = isEdit ? `/api/workplaces/${initialData.id}` : "/api/workplaces";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Bir hata oluştu");
      }

      router.push("/workplaces");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-lg space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-700">
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Building2 className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            {isEdit ? "Görev Yerini Düzenle" : "Yeni Görev Yeri"}
          </h2>
          <p className="text-xs text-slate-400">Tüm alanları eksiksiz doldurun</p>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="label" htmlFor="companyId">Şirket *</label>
        <select
          id="companyId"
          className="select"
          value={formData.companyId}
          onChange={(e) => setFormData((p) => ({ ...p, companyId: e.target.value }))}
          required
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="wpName">Görev Yeri Adı *</label>
        <input
          id="wpName"
          type="text"
          className="input"
          placeholder="Örn: Merkez Ofis"
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="sgkNo">SGK İşyeri Sicil No</label>
        <input
          id="sgkNo"
          type="text"
          className="input"
          placeholder="Örn: 12-345678-01"
          value={formData.sgkRegistrationNo}
          onChange={(e) => setFormData((p) => ({ ...p, sgkRegistrationNo: e.target.value }))}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary flex-1"
          disabled={loading}
        >
          İptal
        </button>
        <button
          type="submit"
          className="btn-primary flex-1"
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor…</>
          ) : (
            isEdit ? "Güncelle" : "Kaydet"
          )}
        </button>
      </div>
    </form>
  );
}
