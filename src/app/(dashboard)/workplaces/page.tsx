import { Header } from "@/components/layout/Header";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus, Building2, MapPin, Hash } from "lucide-react";

export const metadata = { title: "Görev Yerleri" };

async function getWorkplaces() {
  try {
    return await prisma.workplace.findMany({
      include: {
        company: true,
        _count: { select: { employees: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

export default async function WorkplacesPage() {
  const workplaces = await getWorkplaces();

  return (
    <div className="animate-fade-in">
      <Header
        title="Görev Yerleri"
        subtitle={`${workplaces.length} görev yeri`}
        actions={
          <Link href="/workplaces/new" className="btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            Yeni Görev Yeri
          </Link>
        }
      />

      <div className="p-6">
        {workplaces.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-20 gap-4">
            <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <Building2 className="w-10 h-10 text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-slate-200 font-medium">Henüz görev yeri eklenmemiş</p>
              <p className="text-slate-400 text-sm mt-1">
                İlk görev yerinizi ekleyerek başlayın.
              </p>
            </div>
            <Link href="/workplaces/new" className="btn-primary">
              <Plus className="w-4 h-4" />
              Görev Yeri Ekle
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {workplaces.map((wp) => (
              <div key={wp.id} className="card-hover p-5 group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <Building2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="badge-blue">
                    {wp._count.employees} personel
                  </span>
                </div>

                <h3 className="text-base font-semibold text-slate-100 mb-3 group-hover:text-blue-300 transition-colors">
                  {wp.name}
                </h3>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate">{wp.company.name}</span>
                  </div>
                  {wp.sgkRegistrationNo && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Hash className="w-3.5 h-3.5 text-slate-500" />
                      <span>SGK: {wp.sgkRegistrationNo}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                  <Link
                    href={`/workplaces/${wp.id}/edit`}
                    className="btn-secondary btn-sm flex-1 justify-center"
                  >
                    Düzenle
                  </Link>
                  <Link
                    href={`/employees?workplaceId=${wp.id}`}
                    className="btn-secondary btn-sm flex-1 justify-center"
                  >
                    Personel
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
