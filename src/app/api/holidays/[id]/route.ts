import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isNextResponse } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

/**
 * DELETE /api/holidays/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    const existing = await prisma.publicHoliday.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    }

    await prisma.publicHoliday.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "DELETE",
        entity: "PublicHoliday",
        entityId: id,
        beforeJson: existing,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Silinemedi" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/holidays/[id]
 * Update a public holiday's name, type or description
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
    const { name, type, description } = body;

    const existing = await prisma.publicHoliday.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    }

    const updated = await prisma.publicHoliday.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        type: (type === "HALF_DAY" || type === "FULL_DAY") ? type : existing.type,
        description: description !== undefined ? description : existing.description,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "UPDATE",
        entity: "PublicHoliday",
        entityId: id,
        beforeJson: existing,
        afterJson: updated,
      },
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Güncellenemedi" },
      { status: 500 }
    );
  }
}
