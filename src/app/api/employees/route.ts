import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, isNextResponse } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (isNextResponse(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const workplaceId = searchParams.get("workplaceId");
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  // Personel can only see their own employee record
  const employeeIdFilter = auth.role === "personel" ? (auth.employeeId || "NONE") : undefined;

  const employees = await prisma.employee.findMany({
    where: {
      isDeleted: false,
      ...(employeeIdFilter ? { id: employeeIdFilter } : {}),
      ...(workplaceId ? { workplaceId } : {}),
      ...(status ? { status: status as "ACTIVE" | "PASSIVE" | "ON_LEAVE" } : {}),
      ...(q ? {
        OR: [
          { firstName:  { contains: q, mode: "insensitive" } },
          { lastName:   { contains: q, mode: "insensitive" } },
          { employeeNo: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    include: { workplace: true },
    orderBy: [{ lastName: "asc" }],
  });

  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const {
      companyId, workplaceId, employeeNo, firstName, lastName,
      startDate, endDate, status, position,
    } = body;

    if (!companyId || !workplaceId || !employeeNo || !firstName || !lastName || !startDate) {
      return NextResponse.json({ error: "Zorunlu alanlar eksik" }, { status: 400 });
    }

    const employee = await prisma.employee.create({
      data: {
        companyId,
        workplaceId,
        employeeNo,
        firstName,
        lastName,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: status ?? "ACTIVE",
        position: position ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "CREATE",
        entity: "Employee",
        entityId: employee.id,
        afterJson: employee,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (err: unknown) {
    console.error(err);
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Bu sicil no zaten kayıtlı" }, { status: 409 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
