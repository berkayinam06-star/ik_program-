import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, isNextResponse } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { HolidayType } from "@prisma/client";

/**
 * GET /api/holidays?companyId=&year=&month=
 * Returns public holidays for a company (optionally filtered by year/month)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (isNextResponse(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    if (!companyId) {
      return NextResponse.json({ error: "companyId zorunludur" }, { status: 400 });
    }

    const where: Record<string, unknown> = { companyId };

    if (year && month) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      where.date = {
        gte: new Date(Date.UTC(y, m - 1, 1)),
        lte: new Date(Date.UTC(y, m, 0)),
      };
    } else if (year) {
      const y = parseInt(year, 10);
      where.date = {
        gte: new Date(Date.UTC(y, 0, 1)),
        lte: new Date(Date.UTC(y, 11, 31)),
      };
    }

    const holidays = await prisma.publicHoliday.findMany({
      where,
      orderBy: { date: "asc" },
    });

    return NextResponse.json(holidays);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

/**
 * POST /api/holidays
 * Create a new public holiday
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { companyId, date: dateStr, name, type, description } = body;

    if (!companyId || !dateStr || !name) {
      return NextResponse.json(
        { error: "companyId, date ve name zorunludur" },
        { status: 400 }
      );
    }

    const holidayType: HolidayType =
      type === "HALF_DAY" ? "HALF_DAY" : "FULL_DAY";

    const date = new Date(dateStr.slice(0, 10) + "T00:00:00Z");

    // Check for existing holiday on that date
    const existing = await prisma.publicHoliday.findUnique({
      where: { companyId_date: { companyId, date } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Bu tarihte zaten bir resmi tatil tanımlanmış" },
        { status: 409 }
      );
    }

    const holiday = await prisma.publicHoliday.create({
      data: { companyId, date, name, type: holidayType, description: description || null },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: "CREATE",
        entity: "PublicHoliday",
        entityId: holiday.id,
        afterJson: holiday,
      },
    });

    return NextResponse.json(holiday, { status: 201 });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
