import { NextRequest, NextResponse } from "next/server";
import { addAttendanceEvent } from "@/lib/attendance.service";
import { parseIstanbulDateTime } from "@/lib/timezone";
import { AttendanceEventType } from "@prisma/client";
import { requireAdmin, isNextResponse } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { employeeId, date, time, type, note } = body;

    if (!employeeId || !date || !time || !type) {
      return NextResponse.json({ error: "employeeId, date, time, type zorunludur" }, { status: 400 });
    }

    if (type !== "IN" && type !== "OUT") {
      return NextResponse.json({ error: "type IN veya OUT olmalıdır" }, { status: 400 });
    }

    // Parse the Istanbul local datetime to UTC
    const occurredAt = parseIstanbulDateTime(date as string, time as string);

    await addAttendanceEvent({
      employeeId,
      occurredAt,
      type: type as AttendanceEventType,
      source: "MANUAL",
      actorId: auth.id,
      note: note || undefined,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
