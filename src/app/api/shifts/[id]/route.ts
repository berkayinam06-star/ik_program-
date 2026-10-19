import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * DELETE /api/shifts/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shift = await prisma.shiftAssignment.findUnique({ where: { id } });
    if (!shift) {
      return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    }

    await prisma.shiftAssignment.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        actorId: "admin",
        action: "DELETE",
        entity: "ShiftAssignment",
        entityId: id,
        beforeJson: shift as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
