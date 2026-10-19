"use client";

import { useState, useEffect, useCallback } from "react";
import { UserCog, Plus, Pencil, Trash2, X, Check, Eye, EyeOff, Shield, User as UserIcon } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "personel";
  employeeId: string | null;
  isActive: boolean;
  createdAt: string;
};

type Employee = { id: string; firstName: string; lastName: string; employeeNo: string };

type FormState = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "personel";
  employeeId: string;
  isActive: boolean;
};

const empty: FormState = { name: "", email: "", password: "", role: "personel", employeeId: "", isActive: true };

export default function UsersClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, e] = await Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]);
    setUsers(Array.isArray(u) ? u : []);
    setEmployees(Array.isArray(e) ? e : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setError("");
    setShowPw(false);
    setShowModal(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, employeeId: u.employeeId ?? "", isActive: u.isActive });
    setError("");
    setShowPw(false);
    setShowModal(true);
  }

  async function handleSave() {
    setError("");
    if (!form.name || !form.email || (!editing && !form.password)) {
      setError("Ad, e-posta ve sifre zorunludur.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...form, employeeId: form.employeeId || null };
      if (editing && !form.password) delete body.password;

      const res = await fetch(editing ? `/api/users/${editing.id}` : "/api/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Hata olustu");
        return;
      }
      setShowModal(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    load();
  }

  const emp = (id: string | null) => employees.find((e) => e.id === id);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <UserCog className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Kullanici Yonetimi</h1>
            <p className="text-xs text-slate-400">{users.length} kullanici</p>
          </div>
        </div>
        <button
          id="create-user-btn"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          Kullanici Ekle
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">Yukleniyor...</div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
            <UserCog className="w-8 h-8 opacity-40" />
            <p className="text-sm">Henuz kullanici yok. Yukardaki butona tiklayin.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Ad</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">E-posta</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Rol</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Bagli Personel</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Durum</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => {
                const linkedEmp = emp(u.employeeId);
                return (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-200">{u.name}</td>
                    <td className="px-4 py-3 text-slate-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.role === "admin" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "bg-blue-500/20 text-blue-300 border border-blue-500/30"}`}>
                        {u.role === "admin" ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                        {u.role === "admin" ? "Yonetici" : "Personel"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {linkedEmp ? `${linkedEmp.firstName} ${linkedEmp.lastName} (${linkedEmp.employeeNo})` : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${u.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-500"}`}>
                        {u.isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {u.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {deleteConfirm === u.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(u.id)} className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg hover:bg-red-500/30">Sil</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200">Iptal</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(u.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">{editing ? "Kullanici Duzenle" : "Yeni Kullanici"}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Ad Soyad *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition" placeholder="Ahmet Yilmaz" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">E-posta *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition" placeholder="ahmet@sirket.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{editing ? "Yeni Sifre (bos birakabilirsiniz)" : "Sifre *"}</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full pr-10 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Rol *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "personel" })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                  <option value="personel">Personel</option>
                  <option value="admin">Yonetici (Admin)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Bagli Personel (opsiyonel)</label>
                <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                  <option value="">— Secin —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeNo})</option>)}
                </select>
              </div>
              {editing && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded accent-violet-500" />
                  <span className="text-sm text-slate-300">Aktif kullanici</span>
                </label>
              )}
              {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-800">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition">Iptal</button>
              <button id="save-user-btn" onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl transition disabled:opacity-60">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {editing ? "Kaydet" : "Olustur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}