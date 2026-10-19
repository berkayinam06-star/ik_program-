import { Header } from "@/components/layout/Header";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus, Search, Users, Briefcase } from "lucide-react";
import { formatDate } from "@/lib/timezone";

export const metadata = { title: "Personel" };

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE:   { label: "Aktif",     className: "badge-green"  },
  PASSIVE:  { label: "Pasif",     className: "badge-gray"   },
  ON_LEAVE: { label: "İzinli",    className: "badge-yellow" },
};

interface SearchParams {
  workplaceId?: string;
  status?: string;
  q?: string;
}

async function getEmployees(filters: SearchParams) {
  try {
    return await prisma.employee.findMany({
      where: {
        isDeleted: false,
        ...(filters.workplaceId ? { workplaceId: filters.workplaceId } : {}),
        ...(filters.status ? { status: filters.status as "ACTIVE" | "PASSIVE" | "ON_LEAVE" } : {}),
        ...(filters.q
          ? {
              OR: [
                { firstName:  { contains: filters.q, mode: "insensitive" } },
                { lastName:   { contains: filters.q, mode: "insensitive" } },
                { employeeNo: { contains: filters.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        workplace: true,
        company: true,
      },
      orderBy: [{ workplace: { name: "asc" } }, { lastName: "asc" }],
    });
  } catch {
    return [];
  }
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  let employees: Awaited<ReturnType<typeof getEmployees>> = [];
  let workplaces: Array<{ id: string; name: string }> = [];

  try {
    [employees, workplaces] = await Promise.all([
      getEmployees(params),
      prisma.workplace.findMany({ orderBy: { name: "asc" } }),
    ]);
  } catch {
    // fallback
  }

  return (
    <div className="animate-fade-in">
      <Header
        title="Personel Yönetimi"
        subtitle={`${employees.length} personel listeleniyor`}
        actions={
          <Link href="/employees/new" className="btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            Personel Ekle
          </Link>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="card p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <form>
              <input
                name="q"
                type="text"
                className="input pl-9"
                placeholder="Ad, soyad veya sicil no..."
                defaultValue={params.q ?? ""}
              />
            </form>
          </div>
          <form className="flex gap-3">
            {params.q && <input type="hidden" name="q" value={params.q} />}
            <select
              name="workplaceId"
              className="select w-48"
              defaultValue={params.workplaceId ?? ""}
            >
              <option value="">Tüm Görev Yerleri</option>
              {workplaces.map((wp) => (
                <option key={wp.id} value={wp.id}>{wp.name}</option>
              ))}
            </select>
            <select
              name="status"
              className="select w-36"
              defaultValue={params.status ?? ""}
            >
              <option value="">Tüm Durumlar</option>
              <option value="ACTIVE">Aktif</option>
              <option value="PASSIVE">Pasif</option>
              <option value="ON_LEAVE">İzinli</option>
            </select>
            <button type="submit" className="btn-secondary btn-sm">Filtrele</button>
          </form>
        </div>

        {/* Table */}
        {employees.length === 0 ? (
          <div className="card flex flex-col items-center py-16 gap-4">
            <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <Users className="w-10 h-10 text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-slate-200 font-medium">Personel bulunamadı</p>
              <p className="text-slate-400 text-sm mt-1">Filtreleri değiştirin veya yeni personel ekleyin.</p>
            </div>
            <Link href="/employees/new" className="btn-primary btn-sm">
              <Plus className="w-4 h-4" />
              Personel Ekle
            </Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sicil No</th>
                    <th>Ad Soyad</th>
                    <th>Görev Yeri</th>
                    <th>Pozisyon</th>
                    <th>Başlangıç</th>
                    <th>Durum</th>
                    <th className="text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const statusInfo = STATUS_LABELS[emp.status] ?? { label: emp.status, className: "badge-gray" };
                    return (
                      <tr key={emp.id}>
                        <td>
                          <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            #{emp.employeeNo}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <span className="font-medium text-slate-100">
                              {emp.lastName} {emp.firstName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="text-slate-300">{emp.workplace.name}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>{emp.position ?? "—"}</span>
                          </div>
                        </td>
                        <td>
                          <span className="text-slate-400">{formatDate(emp.startDate)}</span>
                        </td>
                        <td>
                          <span className={statusInfo.className}>{statusInfo.label}</span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/attendance/daily?employeeId=${emp.id}`}
                              className="btn-secondary btn-sm"
                            >
                              Devam
                            </Link>
                            <Link
                              href={`/employees/${emp.id}/edit`}
                              className="btn-secondary btn-sm"
                            >
                              Düzenle
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
