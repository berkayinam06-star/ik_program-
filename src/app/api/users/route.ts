import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdmin, isNextResponse } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, employeeId: true, isActive: true, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { name, email, password, role, employeeId } = body;
    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Zorunlu alanlar eksik" }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, employeeId: employeeId || null },
    });
    const { passwordHash: _, ...safe } = user;
    return NextResponse.json(safe, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Bu e-posta zaten kayitli" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Sunucu hatasi" }, { status: 500 });
  }
}