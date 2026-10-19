import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, isNextResponse } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const auth = await requireAuth();
  if (isNextResponse(auth)) return auth;

  const workplaces = await prisma.workplace.findMany({
    include: { company: true, _count: { select: { employees: { where: { status: "ACTIVE" } } } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(workplaces);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { companyId, name, sgkRegistrationNo } = body;

    if (!companyId || !name) {
      return NextResponse.json({ error: "companyId ve name zorunludur" }, { status: 400 });
    }

    const workplace = await prisma.workplace.create({
      data: { companyId, name, sgkRegistrationNo: sgkRegistrationNo || null },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "CREATE",
        entity: "Workplace",
        entityId: workplace.id,
        afterJson: workplace,
      },
    });

    return NextResponse.json(workplace, { status: 201 });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
