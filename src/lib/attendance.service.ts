/**
 * Attendance Calculation Service
 *
 * Business Rules:
 * 1. Multiple IN/OUT pairs per day are supported (lunch breaks, etc.)
 * 2. IN/OUT events are matched in chronological order (first IN → first OUT, etc.)
 * 3. Break policy minutes are deducted from total worked time
 * 4. Night shift: OUT after midnight belongs to the shift's start date
 * 5. Overtime = workedMinutes - plannedMinutes (from ShiftAssignment), if positive
 *    ─ If NO shift is assigned for the day, overtime = 0 (no plan → no FM)
 * 6. recalculateAttendanceDay NEVER overwrites a protected status
 *    (ANNUAL_LEAVE, SICK_LEAVE, EXCUSED, PUBLIC_HOLIDAY, REST_DAY, HALF_DAY)
 *    even if attendance events exist for that day.
 */

import { AttendanceEventType, AttendanceDayStatus } from "@prisma/client";
import prisma from "./prisma";
import { getWorkDate } from "./timezone";

export interface AttendanceEventInput {
  employeeId: string;
  occurredAt: Date;
  type: AttendanceEventType;
  source?: "MANUAL" | "DEVICE";
  actorId?: string;
  note?: string;
}

export interface DayCalculationResult {
  workedMinutes: number;
  overtimeMinutes: number;
  pairedEvents: Array<{ inAt: Date; outAt: Date; durationMinutes: number }>;
  unpaired: Date[]; // IN events without a matching OUT
}

/**
 * Statuses that, once set manually, must NOT be overwritten by the auto-recalc.
 * These represent leave/holiday states that require admin intent to set.
 */
const PROTECTED_STATUSES: AttendanceDayStatus[] = [
  AttendanceDayStatus.ANNUAL_LEAVE,
  AttendanceDayStatus.SICK_LEAVE,
  AttendanceDayStatus.EXCUSED,
  AttendanceDayStatus.PUBLIC_HOLIDAY,
  AttendanceDayStatus.REST_DAY,
  AttendanceDayStatus.HALF_DAY,
];

/**
 * Calculate worked minutes from a list of IN/OUT events for a single work date.
 * Handles multiple punch-in/punch-out pairs.
 *
 * @param events - All events for the work date, must include type and occurredAt
 * @param breakPolicyMinutes - Minutes to deduct for breaks
 */
export function calculateWorkedMinutes(
  events: Array<{ occurredAt: Date; type: AttendanceEventType }>,
  breakPolicyMinutes = 0
): DayCalculationResult {
  // Sort chronologically
  const sorted = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
  );

  const pairs: Array<{ inAt: Date; outAt: Date; durationMinutes: number }> = [];
  const inQueue: Date[] = [];

  for (const event of sorted) {
    if (event.type === AttendanceEventType.IN) {
      inQueue.push(event.occurredAt);
    } else if (event.type === AttendanceEventType.OUT && inQueue.length > 0) {
      const inAt = inQueue.shift()!;
      const outAt = event.occurredAt;
      const durationMinutes = Math.round(
        (outAt.getTime() - inAt.getTime()) / 60_000
      );
      if (durationMinutes > 0) {
        pairs.push({ inAt, outAt, durationMinutes });
      }
    }
  }

  const totalRawMinutes = pairs.reduce((sum, p) => sum + p.durationMinutes, 0);
  const workedMinutes = Math.max(0, totalRawMinutes - breakPolicyMinutes);

  return {
    workedMinutes,
    overtimeMinutes: 0, // Populated later when shift assignment is known
    pairedEvents: pairs,
    unpaired: inQueue,
  };
}

/**
 * Recalculates and upserts an AttendanceDay record for a given employee + workDate.
 * Fetches events and shift assignment from DB, then computes the result.
 *
 * IMPORTANT: Protected statuses (leave, holiday, etc.) are never overwritten.
 *
 * @param employeeId - Employee ID
 * @param workDate - UTC midnight date representing the work day
 * @param actorId - Who triggered the recalculation (for audit)
 */
export async function recalculateAttendanceDay(
  employeeId: string,
  workDate: Date,
  actorId?: string
): Promise<void> {
  // 1. Check payroll period lock
  const year  = workDate.getUTCFullYear();
  const month = workDate.getUTCMonth() + 1;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true },
  });
  if (!employee) throw new Error(`Employee not found: ${employeeId}`);

  const period = await prisma.payrollPeriod.findUnique({
    where: {
      companyId_year_month: {
        companyId: employee.companyId,
        year,
        month,
      },
    },
  });

  if (period?.isLocked) {
    throw new Error(
      `Dönem kilitli: ${year}/${String(month).padStart(2, "0")}. Düzenleme yapılamaz.`
    );
  }

  // 2. Check if existing record has a protected status or is approved — skip status overwrite
  const existing = await prisma.attendanceDay.findUnique({
    where: { employeeId_workDate: { employeeId, workDate } },
  });

  const LEAVE_STATUSES: AttendanceDayStatus[] = [
    AttendanceDayStatus.ANNUAL_LEAVE,
    AttendanceDayStatus.SICK_LEAVE,
    AttendanceDayStatus.EXCUSED,
    AttendanceDayStatus.PUBLIC_HOLIDAY,
    AttendanceDayStatus.REST_DAY,
  ];

  if (existing && (PROTECTED_STATUSES.includes(existing.status) || existing.isApproved)) {
    // If the day is an approved leave or holiday: status is strictly preserved and overtime is 0
    if (LEAVE_STATUSES.includes(existing.status)) {
      if (existing.overtimeMinutes !== 0) {
        await prisma.attendanceDay.update({
          where: { id: existing.id },
          data: { overtimeMinutes: 0 },
        });
      }
      return;
    }

    // For HALF_DAY or already approved days: only update worked/overtime if punch events exist
    const events = await prisma.attendanceEvent.findMany({
      where: { employeeId, workDate },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true, type: true },
    });

    if (events.length === 0) {
      return;
    }

    const shift = await prisma.shiftAssignment.findUnique({
      where: { employeeId_workDate: { employeeId, workDate } },
    });

    const breakPolicyMinutes = shift?.breakPolicyMinutes ?? 0;
    const { workedMinutes } = calculateWorkedMinutes(events, breakPolicyMinutes);

    // FM: only when shift assignment exists and workedMinutes > plannedMinutes
    let overtimeMinutes = 0;
    if (shift) {
      const plannedMinutes = Math.max(0, Math.round(
        (shift.plannedEndAt.getTime() - shift.plannedStartAt.getTime()) / 60_000
      ) - (shift.breakPolicyMinutes ?? 0));
      if (plannedMinutes > 0 && workedMinutes > plannedMinutes) {
        overtimeMinutes = workedMinutes - plannedMinutes;
      }
    }

    await prisma.attendanceDay.update({
      where: { id: existing.id },
      data: { workedMinutes, overtimeMinutes },
    });
    return;
  }

  // 3. Fetch all attendance events for this work date
  const events = await prisma.attendanceEvent.findMany({
    where: { employeeId, workDate },
    orderBy: { occurredAt: "asc" },
    select: { occurredAt: true, type: true },
  });

  // 4. Fetch shift assignment for break policy and planned hours
  const shift = await prisma.shiftAssignment.findUnique({
    where: { employeeId_workDate: { employeeId, workDate } },
  });

  const breakPolicyMinutes = shift?.breakPolicyMinutes ?? 0;
  const { workedMinutes } = calculateWorkedMinutes(events, breakPolicyMinutes);

  // 5. Calculate overtime vs planned
  // BUG FIX: If there is NO shift assignment for this day, overtime = 0.
  // Overtime only applies when an employee works BEYOND their planned shift.
  // Working on an unplanned day is recorded as normal work (not FM).
  let overtimeMinutes = 0;
  if (shift) {
    const plannedMinutes = Math.max(0, Math.round(
      (shift.plannedEndAt.getTime() - shift.plannedStartAt.getTime()) / 60_000
    ) - (shift.breakPolicyMinutes ?? 0));
    if (plannedMinutes > 0 && workedMinutes > plannedMinutes) {
      overtimeMinutes = workedMinutes - plannedMinutes;
    } else {
      overtimeMinutes = 0;
    }
  } else {
    overtimeMinutes = 0;
  }

  // 6. Determine status
  let newStatus: AttendanceDayStatus;
  if (workedMinutes > 0) {
    newStatus = AttendanceDayStatus.PRESENT;
  } else {
    // Check if workDate is a registered public holiday for employee's company
    const holiday = await prisma.publicHoliday.findUnique({
      where: {
        companyId_date: {
          companyId: employee.companyId,
          date: workDate,
        },
      },
    });

    if (holiday) {
      newStatus = AttendanceDayStatus.PUBLIC_HOLIDAY;
    } else {
      newStatus = AttendanceDayStatus.ABSENT;
    }
  }

  const newData = {
    workedMinutes,
    overtimeMinutes,
    status: newStatus,
  };

  if (existing) {
    // Audit log the change
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "UPDATE",
        entity: "AttendanceDay",
        entityId: existing.id,
        beforeJson: {
          workedMinutes: existing.workedMinutes,
          overtimeMinutes: existing.overtimeMinutes,
          status: existing.status,
        },
        afterJson: newData,
      },
    });

    await prisma.attendanceDay.update({
      where: { id: existing.id },
      data: newData,
    });
  } else {
    const created = await prisma.attendanceDay.create({
      data: {
        employeeId,
        workDate,
        ...newData,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId,
        action: "CREATE",
        entity: "AttendanceDay",
        entityId: created.id,
        afterJson: newData,
      },
    });
  }
}

/**
 * Add a new attendance event (IN or OUT) and immediately recalculate the day.
 * This is the main entry point for manual attendance entry.
 */
export async function addAttendanceEvent(
  input: AttendanceEventInput
): Promise<void> {
  const workDate = getWorkDate(input.occurredAt);

  // Check if period is locked BEFORE creating the event
  const year  = workDate.getUTCFullYear();
  const month = workDate.getUTCMonth() + 1;

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { companyId: true },
  });
  if (!employee) throw new Error(`Employee not found: ${input.employeeId}`);

  const period = await prisma.payrollPeriod.findUnique({
    where: {
      companyId_year_month: {
        companyId: employee.companyId,
        year,
        month,
      },
    },
  });

  if (period?.isLocked) {
    throw new Error(
      `Dönem kilitli: ${year}/${String(month).padStart(2, "0")}. Yeni kayıt eklenemez.`
    );
  }

  // Create the event
  const created = await prisma.attendanceEvent.create({
    data: {
      employeeId: input.employeeId,
      occurredAt: input.occurredAt,
      workDate,
      type: input.type,
      source: input.source ?? "MANUAL",
      actorId: input.actorId,
      note: input.note,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: "CREATE",
      entity: "AttendanceEvent",
      entityId: created.id,
      afterJson: {
        employeeId: created.employeeId,
        occurredAt: created.occurredAt,
        workDate: created.workDate,
        type: created.type,
        source: created.source,
      },
    },
  });

  // Recalculate the day
  await recalculateAttendanceDay(input.employeeId, workDate, input.actorId);
}

/**
 * Delete an attendance event and recalculate the affected day.
 */
export async function deleteAttendanceEvent(
  eventId: string,
  actorId?: string
): Promise<void> {
  const event = await prisma.attendanceEvent.findUnique({
    where: { id: eventId },
    include: { employee: { select: { companyId: true } } },
  });
  if (!event) throw new Error(`Event not found: ${eventId}`);

  // Check lock
  const year  = event.workDate.getUTCFullYear();
  const month = event.workDate.getUTCMonth() + 1;

  const period = await prisma.payrollPeriod.findUnique({
    where: {
      companyId_year_month: {
        companyId: event.employee.companyId,
        year,
        month,
      },
    },
  });

  if (period?.isLocked) {
    throw new Error(`Dönem kilitli. Silme işlemi yapılamaz.`);
  }

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "DELETE",
      entity: "AttendanceEvent",
      entityId: event.id,
      beforeJson: {
        employeeId: event.employeeId,
        occurredAt: event.occurredAt,
        workDate: event.workDate,
        type: event.type,
      },
    },
  });

  await prisma.attendanceEvent.delete({ where: { id: eventId } });
  await recalculateAttendanceDay(event.employeeId, event.workDate, actorId);
}

/**
 * Lock a payroll period. After locking, no attendance edits are allowed.
 */
export async function lockPayrollPeriod(
  companyId: string,
  year: number,
  month: number,
  actorId?: string
): Promise<void> {
  const period = await prisma.payrollPeriod.upsert({
    where: { companyId_year_month: { companyId, year, month } },
    update: { isLocked: true, lockedAt: new Date(), lockedBy: actorId },
    create: { companyId, year, month, isLocked: true, lockedAt: new Date(), lockedBy: actorId },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "LOCK",
      entity: "PayrollPeriod",
      entityId: period.id,
      afterJson: { companyId, year, month, isLocked: true },
    },
  });
}

/**
 * Unlock a payroll period (admin override).
 */
export async function unlockPayrollPeriod(
  companyId: string,
  year: number,
  month: number,
  actorId?: string
): Promise<void> {
  const period = await prisma.payrollPeriod.update({
    where: { companyId_year_month: { companyId, year, month } },
    data: { isLocked: false, lockedAt: null, lockedBy: null },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "UNLOCK",
      entity: "PayrollPeriod",
      entityId: period.id,
      afterJson: { companyId, year, month, isLocked: false },
    },
  });
}

export { formatMinutes } from "./timezone";
