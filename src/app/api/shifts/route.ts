import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, isNextResponse } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/shifts?employeeId=&year=&month=
 * Returns shift assignments for an employee (optionally filtered by month)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (isNextResponse(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    const where: Record<string, unknown> = {};
    if (auth.role === "personel") {
      where.employeeId = auth.employeeId || "NONE";
    } else if (employeeId) {
      where.employeeId = employeeId;
    }
    if (year && month) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      where.workDate = {
        gte: new Date(Date.UTC(y, m - 1, 1)),
        lte: new Date(Date.UTC(y, m, 0)),
      };
    }

    const shifts = await prisma.shiftAssignment.findMany({
      where,
      orderBy: [{ workDate: "asc" }],
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNo: true,
            workplace: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json(shifts);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

/**
 * POST /api/shifts
 * Create or update (upsert) a shift assignment for an employee+date.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const {
      employeeId,
      workDate: workDateStr,
      plannedStartTime,
      plannedEndTime,
      breakPolicyMinutes,
    } = body;

    if (!employeeId || !workDateStr || !plannedStartTime || !plannedEndTime) {
      return NextResponse.json(
        { error: "employeeId, workDate, plannedStartTime, plannedEndTime zorunludur" },
        { status: 400 }
      );
    }

    // Parse date (YYYY-MM-DD) + times (HH:mm) as UTC+3 (Istanbul)
    const [sy, sm, sd] = workDateStr.split("-").map(Number);
    const [sh, smin] = plannedStartTime.split(":").map(Number);
    const [eh, emin] = plannedEndTime.split(":").map(Number);

    const workDate = new Date(Date.UTC(sy, sm - 1, sd));
    // Istanbul = UTC+3
    const plannedStartAt = new Date(Date.UTC(sy, sm - 1, sd, sh - 3, smin, 0));
    let plannedEndAt = new Date(Date.UTC(sy, sm - 1, sd, eh - 3, emin, 0));

    // If end time < start time (night shift crossing midnight)
    if (plannedEndAt <= plannedStartAt) {
      plannedEndAt = new Date(plannedEndAt.getTime() + 24 * 60 * 60 * 1000);
    }

    const breakMins = parseInt(String(breakPolicyMinutes ?? "0"), 10) || 0;

    // Check payroll period lock
    const year = sy;
    const month = sm;
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
        { error: "Dönem kilitli. Vardiya ataması yapılamaz." },
        { status: 403 }
      );
    }

    const shift = await prisma.shiftAssignment.upsert({
      where: { employeeId_workDate: { employeeId, workDate } },
      update: { plannedStartAt, plannedEndAt, breakPolicyMinutes: breakMins },
      create: {
        employeeId,
        workDate,
        plannedStartAt,
        plannedEndAt,
        breakPolicyMinutes: breakMins,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "UPSERT",
        entity: "ShiftAssignment",
        entityId: shift.id,
        afterJson: { employeeId, workDate: workDateStr, plannedStartTime, plannedEndTime, breakPolicyMinutes: breakMins },
      },
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
