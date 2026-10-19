import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  employeeId?: string;
};

/** Returns session user or a 401 NextResponse */
export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Oturum acmaniz gerekiyor" }, { status: 401 });
  }
  return session.user as SessionUser;
}

/** Returns session user if admin, else returns 403 NextResponse */
export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (result.role !== "admin") {
    return NextResponse.json({ error: "Bu islemi yapma yetkiniz yok" }, { status: 403 });
  }
  return result;
}

export function isNextResponse(val: unknown): val is NextResponse {
  return val instanceof NextResponse;
}