import { NextRequest, NextResponse } from "next/server";
import { deleteAttendanceEvent, recalculateAttendanceDay } from "@/lib/attendance.service";
import prisma from "@/lib/prisma";
import { parseIstanbulDateTime } from "@/lib/timezone";
import { AttendanceEventType } from "@prisma/client";
import { requireAdmin, isNextResponse } from "@/lib/api-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    const body = await req.json();
    const { date, time, type, note } = body;

    const event = await prisma.attendanceEvent.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
    }

    const newOccurredAt =
      date && time ? parseIstanbulDateTime(date as string, time as string) : event.occurredAt;
    const newType: AttendanceEventType =
      type === "IN" || type === "OUT" ? type : event.type;

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "UPDATE",
        entity: "AttendanceEvent",
        entityId: id,
        beforeJson: { occurredAt: event.occurredAt, type: event.type, note: event.note },
        afterJson: { occurredAt: newOccurredAt, type: newType, note: note ?? event.note },
      },
    });

    await prisma.attendanceEvent.update({
      where: { id },
      data: {
        occurredAt: newOccurredAt,
        type: newType,
        note: note !== undefined ? note : event.note,
      },
    });

    // Recalculate the day summary
    await recalculateAttendanceDay(event.employeeId, event.workDate, auth.id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    await deleteAttendanceEvent(id, auth.id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Silinemedi" },
      { status: 500 }
    );
  }
}
