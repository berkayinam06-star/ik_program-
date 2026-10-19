/**
 * Companies API — seed şirketi otomatik oluşturma
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, isNextResponse } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const auth = await requireAuth();
  if (isNextResponse(auth)) return auth;

  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "name zorunludur" }, { status: 400 });
    }

    const company = await prisma.company.create({ data: { name } });

    await prisma.auditLog.create({
      data: { action: "CREATE", entity: "Company", entityId: company.id, afterJson: company },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
