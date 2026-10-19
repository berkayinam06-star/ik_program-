import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AttendanceDayStatus, Prisma } from "@prisma/client";
import { requireAdmin, isNextResponse } from "@/lib/api-auth";

/**
 * PATCH /api/attendance/days/[id]
 * Update status, workedMinutes, and/or isApproved for a specific AttendanceDay record.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    const body = await req.json();
    const {
      status,
      isApproved,
      note,
      workedMinutes: inputWorkedMinutes,
    } = body;

    const existing = await prisma.attendanceDay.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
    }

    // Check payroll period lock
    const year  = existing.workDate.getUTCFullYear();
    const month = existing.workDate.getUTCMonth() + 1;

    const employee = await prisma.employee.findUnique({
      where: { id: existing.employeeId },
      select: { companyId: true },
    });

    if (employee) {
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
    }

    const targetStatus: AttendanceDayStatus = status
      ? (status as AttendanceDayStatus)
      : existing.status;

    const validStatuses = Object.values(AttendanceDayStatus);
    if (status && !validStatuses.includes(targetStatus)) {
      return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
    }

    // Check shift assignment
    const shift = await prisma.shiftAssignment.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: existing.employeeId,
          workDate: existing.workDate,
        },
      },
    });

    let workedMinutes = existing.workedMinutes;
    let overtimeMinutes = 0;

    if (targetStatus === AttendanceDayStatus.PRESENT) {
      if (inputWorkedMinutes !== undefined && inputWorkedMinutes !== null) {
        workedMinutes = Number(inputWorkedMinutes);
      } else if (existing.workedMinutes > 0) {
        workedMinutes = existing.workedMinutes;
      } else if (shift) {
        const plannedMinutes = Math.max(
          0,
          Math.round((shift.plannedEndAt.getTime() - shift.plannedStartAt.getTime()) / 60_000) -
            (shift.breakPolicyMinutes ?? 0)
        );
        workedMinutes = plannedMinutes > 0 ? plannedMinutes : 480;
      } else {
        workedMinutes = 480; // 8 saat varsayılan normal çalışma
      }

      // FM Hesabı:
      // Vardiya atanmamış günde FM kesinlikle 0 kalır.
      // SADECE atanmış bir vardiya varsa ve çalışma bunu aşıyorsa fark FM olur:
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
    } else if (targetStatus === AttendanceDayStatus.HALF_DAY) {
      workedMinutes = inputWorkedMinutes !== undefined ? Number(inputWorkedMinutes) : 240;
      overtimeMinutes = 0;
    } else {
      // İzinli/raporlu günler
      workedMinutes = 0;
      overtimeMinutes = 0;
    }

    const updateData: {
      status?: AttendanceDayStatus;
      workedMinutes?: number;
      overtimeMinutes?: number;
      isApproved?: boolean;
      note?: string | null;
    } = {
      status: targetStatus,
      workedMinutes,
      overtimeMinutes,
    };

    if (isApproved !== undefined) {
      updateData.isApproved = Boolean(isApproved);
    }
    if (note !== undefined) {
      updateData.note = note || null;
    }

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "UPDATE",
        entity: "AttendanceDay",
        entityId: id,
        beforeJson: {
          status: existing.status,
          workedMinutes: existing.workedMinutes,
          overtimeMinutes: existing.overtimeMinutes,
          isApproved: existing.isApproved,
          note: existing.note,
        },
        afterJson: updateData,
      },
    });

    const updated = await prisma.attendanceDay.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/attendance/days/[id]
 * Resets / deletes a day record so the cell becomes empty again.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    const existing = await prisma.attendanceDay.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
    }

    // Check lock
    const year  = existing.workDate.getUTCFullYear();
    const month = existing.workDate.getUTCMonth() + 1;
    const employee = await prisma.employee.findUnique({
      where: { id: existing.employeeId },
      select: { companyId: true },
    });
    if (employee) {
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
    }

    await prisma.attendanceDay.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "DELETE",
        entity: "AttendanceDay",
        entityId: id,
        beforeJson: existing as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
