import { Header } from "@/components/layout/Header";
import prisma from "@/lib/prisma";
import { EventsTable } from "@/components/attendance/EventsTable";

export const dynamic = "force-dynamic";

export default async function AttendanceEventsPage() {
  const events = await prisma.attendanceEvent.findMany({
    orderBy: { occurredAt: "desc" },
    take: 200,
    select: {
      id: true,
      occurredAt: true,
      workDate: true,
      type: true,
      source: true,
      note: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNo: true,
          workplace: { select: { name: true } },
        },
      },
    },
  });

  const serialized = events.map((e) => ({
    ...e,
    occurredAt: e.occurredAt.toISOString(),
    workDate: e.workDate.toISOString(),
  }));

  return (
    <div className="animate-fade-in">
      <Header
        title="Son Hareketler"
        subtitle="Son 200 giriş/çıkış kaydı — düzenle veya sil"
      />
      <div className="p-6">
        <EventsTable events={serialized} />
      </div>
    </div>
  );
}
