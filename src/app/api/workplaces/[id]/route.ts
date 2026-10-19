import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isNextResponse } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, sgkRegistrationNo } = body;

    const existing = await prisma.workplace.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

    const updated = await prisma.workplace.update({
      where: { id },
      data: { name, sgkRegistrationNo: sgkRegistrationNo || null },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "UPDATE",
        entity: "Workplace",
        entityId: id,
        beforeJson: existing,
        afterJson: updated,
      },
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
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
    const existing = await prisma.workplace.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

    await prisma.workplace.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "DELETE",
        entity: "Workplace",
        entityId: id,
        beforeJson: existing,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
