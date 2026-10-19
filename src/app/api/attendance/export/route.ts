import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, isNextResponse } from "@/lib/api-auth";
import { generateMonthlyAttendanceExcel } from "@/lib/excel.service";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const companyId   = searchParams.get("companyId");
    const year        = parseInt(searchParams.get("year")  ?? "0", 10);
    const month       = parseInt(searchParams.get("month") ?? "0", 10);
    const workplaceId = searchParams.get("workplaceId") ?? undefined;

    if (!companyId || !year || !month) {
      return NextResponse.json({ error: "companyId, year, month zorunludur" }, { status: 400 });
    }

    const buffer = await generateMonthlyAttendanceExcel({
      companyId,
      workplaceId,
      year,
      month,
    });

    const filename = `puantaj_${year}_${String(month).padStart(2, "0")}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Excel oluşturulamadı" },
      { status: 500 }
    );
  }
}
