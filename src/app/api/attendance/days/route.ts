import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AttendanceDayStatus } from "@prisma/client";
import { requireAdmin, isNextResponse } from "@/lib/api-auth";

/**
 * POST /api/attendance/days — create or upsert a day record with a specific status
 * Used by the monthly matrix "quick status set" and daily attendance screens.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const {
      employeeId,
      workDate: workDateStr,
      status,
      isApproved,
      note,
      workedMinutes: inputWorkedMinutes,
    } = body;

    if (!employeeId || !workDateStr || !status) {
      return NextResponse.json(
        { error: "employeeId, workDate ve status zorunludur" },
        { status: 400 }
      );
    }

    const validStatuses = Object.values(AttendanceDayStatus);
    if (!validStatuses.includes(status as AttendanceDayStatus)) {
      return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
    }

    const workDate = new Date(workDateStr.slice(0, 10) + "T00:00:00Z");

    // Check payroll period lock
    const year  = workDate.getUTCFullYear();
    const month = workDate.getUTCMonth() + 1;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    });
    if (!employee) {
      return NextResponse.json({ error: "Personel bulunamadı" }, { status: 404 });
    }

    const period = await prisma.payrollPeriod.findUnique({
      where: {
        companyId_year_month: { companyId: employee.companyId, year, month },
      },
    });
    if (period?.isLocked) {
      return NextResponse.json(
        { error: "Dönem kilitli. Düzenleme yapılamaz." },
        { status: 403 }
      );
    }

    // Check shift assignment for this employee and date
    const shift = await prisma.shiftAssignment.findUnique({
      where: { employeeId_workDate: { employeeId, workDate } },
    });

    let workedMinutes = 0;
    let overtimeMinutes = 0;

    if (status === AttendanceDayStatus.PRESENT) {
      if (inputWorkedMinutes !== undefined && inputWorkedMinutes !== null) {
        workedMinutes = Number(inputWorkedMinutes);
      } else if (shift) {
        const plannedMinutes = Math.max(
          0,
          Math.round((shift.plannedEndAt.getTime() - shift.plannedStartAt.getTime()) / 60_000) -
            (shift.breakPolicyMinutes ?? 0)
        );
        workedMinutes = plannedMinutes > 0 ? plannedMinutes : 480;
      } else {
        // Vardiyası olmayan günde varsayılan çalışma saati 8 saat (480 dakika)
        workedMinutes = 480;
      }

      // FM Hesabı:
      // Vardiyası (planı) olmayan bir güne çalışma girildiğinde plan 0 diye FM sayılmaz;
      // tüm süre doğrudan normal çalışma olarak işlenir, FM = 0 kalır.
      // YALNIZCA atanmış bir vardiya varsa ve gerçekleşen net çalışma bu planı aşıyorsa:
      if (shift) {
        const plannedMinutes = Math.max(
          0,
          Math.round((shift.plannedEndAt.getTime() - shift.plannedStartAt.getTime()) / 60_000) -
            (shift.breakPolicyMinutes ?? 0)
        );
        if (plannedMinutes > 0 && workedMinutes > plannedMinutes) {
          overtimeMinutes = workedMinutes - plannedMinutes;
        } else {
          overtimeMinutes = 0;
        }
      } else {
        overtimeMinutes = 0;
      }
    } else if (status === AttendanceDayStatus.HALF_DAY) {
      workedMinutes = inputWorkedMinutes !== undefined ? Number(inputWorkedMinutes) : 240; // 4 saat
      overtimeMinutes = 0;
    } else {
      // İzinli/raporlu günler (ANNUAL_LEAVE, SICK_LEAVE, EXCUSED, PUBLIC_HOLIDAY, REST_DAY, ABSENT)
      // Bu günlerde çalışma süresi 0 ve FM kesinlikle 0'dır.
      workedMinutes = 0;
      overtimeMinutes = 0;
    }

    const updateData: {
      status: AttendanceDayStatus;
      workedMinutes: number;
      overtimeMinutes: number;
      isApproved?: boolean;
      note?: string | null;
    } = {
      status: status as AttendanceDayStatus,
      workedMinutes,
      overtimeMinutes,
    };
    if (isApproved !== undefined) {
      updateData.isApproved = Boolean(isApproved);
    }
    if (note !== undefined) {
      updateData.note = note || null;
    }

    const record = await prisma.attendanceDay.upsert({
      where: { employeeId_workDate: { employeeId, workDate } },
      update: updateData,
      create: {
        employeeId,
        workDate,
        status: status as AttendanceDayStatus,
        isApproved: isApproved !== undefined ? Boolean(isApproved) : false,
        note: note || null,
        workedMinutes,
        overtimeMinutes,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "UPSERT_STATUS",
        entity: "AttendanceDay",
        entityId: record.id,
        afterJson: {
          employeeId,
          workDate: workDateStr,
          status,
          workedMinutes,
          overtimeMinutes,
          isApproved,
          note,
        },
      },
    });

    return NextResponse.json(record);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
