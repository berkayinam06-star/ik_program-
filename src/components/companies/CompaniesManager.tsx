"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Building2, Check, X } from "lucide-react";

interface Company {
  id: string;
  name: string;
  createdAt: string;
}

interface Props {
  companies: Company[];
}

export function CompaniesManager({ companies: initial }: Props) {
  const router = useRouter();
  const [companies, setCompanies] = useState(initial);
  const [newName, setNewName]     = useState("");
  const [editId, setEditId]       = useState<string | null>(null);
  const [editName, setEditName]   = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.trim() }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Hata");
        const created = await res.json();
        setCompanies((prev) => [...prev, { ...created, createdAt: created.createdAt ?? new Date().toISOString() }]);
        setNewName("");
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Hata");
      }
    });
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/companies/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName.trim() }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Hata");
        const updated = await res.json();
        setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, name: updated.name } : c));
        setEditId(null);
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Hata");
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`"${name}" şirketini silmek istiyor musunuz?\nBağlı personel veya görev yeri varsa silinemez.`)) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Silinemedi");
        setCompanies((prev) => prev.filter((c) => c.id !== id));
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Silinemedi");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Add Company */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-400" />
          Yeni Şirket Ekle
        </h3>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            className="input flex-1"
            placeholder="Şirket adı…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Ekle</>}
          </button>
        </form>
      </div>

      {/* Companies List */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300">
            Şirket Listesi
            <span className="ml-2 text-slate-500 font-normal">({companies.length} şirket)</span>
          </h3>
        </div>

        {companies.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            Henüz şirket kaydı yok.
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {companies.map((company) => (
              <div key={company.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-800/30 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/30 to-cyan-600/30 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-blue-400" />
                </div>

                <div className="flex-1">
                  {editId === company.id ? (
                    <input
                      type="text"
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdate(company.id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <p className="text-slate-100 font-medium">{company.name}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {editId === company.id ? (
                    <>
                      <button
                        onClick={() => handleUpdate(company.id)}
                        disabled={isPending}
                        className="btn-icon btn-sm text-emerald-400 hover:bg-emerald-500/10"
                        title="Kaydet"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="btn-icon btn-sm text-slate-400 hover:bg-slate-700"
                        title="İptal"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditId(company.id); setEditName(company.name); }}
                        className="btn-icon btn-sm text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                        title="Düzenle"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(company.id, company.name)}
                        disabled={isPending}
                        className="btn-icon btn-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
