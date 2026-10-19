import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Unauthenticated requests
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Yetkisiz erisim (401)" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based protection: "personel" cannot access admin management screens
  if (token.role === "personel") {
    const adminPages = [
      "/users",
      "/payroll",
      "/workplaces",
      "/companies",
      "/shifts",
      "/employees",
      "/holidays",
      "/attendance/events",
      "/attendance/daily",
    ];
    if (adminPages.some((page) => pathname.startsWith(page))) {
      return NextResponse.redirect(new URL("/my-attendance", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};