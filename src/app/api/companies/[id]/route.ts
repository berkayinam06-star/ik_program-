import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/companies/[id]
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: { workplaces: { orderBy: { name: "asc" } } },
  });
  if (!company) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json(company);
}

/**
 * PUT /api/companies/[id]
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "name zorunludur" }, { status: 400 });
    }

    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

    const updated = await prisma.company.update({ where: { id }, data: { name } });

    await prisma.auditLog.create({
      data: {
        actorId: "admin",
        action: "UPDATE",
        entity: "Company",
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
 * DELETE /api/companies/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

    await prisma.company.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        actorId: "admin",
        action: "DELETE",
        entity: "Company",
        entityId: id,
        beforeJson: existing as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Bu şirkete bağlı çalışan veya görev yeri var. Önce bunları kaldırın." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
