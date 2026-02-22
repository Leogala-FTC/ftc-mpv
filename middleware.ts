import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const protectedPaths = ["/home", "/pay", "/wallet", "/topup", "/profile", "/merchant", "/admin"];
  const needsAuth = protectedPaths.some((p) => path.startsWith(p));

  if (!user && needsAuth) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  if (user && (path.startsWith("/merchant") || path.startsWith("/admin"))) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = profile?.role;

    if (path.startsWith("/merchant") && !(role === "merchant" || role === "admin")) {
      return NextResponse.redirect(new URL("/home", req.url));
    }

    if (path.startsWith("/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/home", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
