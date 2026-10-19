import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, isNextResponse } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * DELETE /api/employees/[id]  →  Soft delete: sets isDeleted = true
 * This preserves all attendance history (AttendanceDay, AttendanceEvent).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  if (auth.role === "personel" && auth.employeeId !== id) {
    return NextResponse.json({ error: "Erişim yetkiniz yok" }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { workplace: true, company: true },
  });
  if (!employee) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        workplaceId: body.workplaceId ?? existing.workplaceId,
        firstName:   body.firstName  ?? existing.firstName,
        lastName:    body.lastName   ?? existing.lastName,
        position:    body.position   ?? existing.position,
        startDate:   body.startDate ? new Date(body.startDate) : existing.startDate,
        endDate:     body.endDate ? new Date(body.endDate) : null,
        status:      body.status ?? existing.status,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "UPDATE",
        entity: "Employee",
        entityId: id,
        beforeJson: existing as unknown as Prisma.InputJsonValue,
        afterJson: updated as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

/**
 * Soft delete: marks the employee as deleted without removing DB records.
 * All attendance history is preserved.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

    // Soft delete: set isDeleted = true and status = PASSIVE
    const updated = await prisma.employee.update({
      where: { id },
      data: { isDeleted: true, status: "PASSIVE", endDate: existing.endDate ?? new Date() },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "SOFT_DELETE",
        entity: "Employee",
        entityId: id,
        beforeJson: existing as unknown as Prisma.InputJsonValue,
        afterJson: { isDeleted: true } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true, id: updated.id });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
