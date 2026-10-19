import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, isNextResponse } from "@/lib/api-auth";
import { lockPayrollPeriod, unlockPayrollPeriod } from "@/lib/attendance.service";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { companyId, year, month, lock } = body;

    if (!companyId || !year || !month) {
      return NextResponse.json({ error: "companyId, year, month zorunludur" }, { status: 400 });
    }

    const actorId = auth.id;

    if (lock) {
      await lockPayrollPeriod(companyId, year, month, actorId);
    } else {
      await unlockPayrollPeriod(companyId, year, month, actorId);
    }

    return NextResponse.json({ success: true, isLocked: lock });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
