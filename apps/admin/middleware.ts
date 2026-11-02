import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication.
// `/preview` renders only static template designs (no tenant data), so it is
// public, this lets the marketing site embed the real template preview and
// lets thumbnails be generated from the actual renderer.
const publicRoutes = [
  "/login",
  "/start",
  "/forgot-password",
  "/reset-password",
  "/preview",
];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ["/login", "/start"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Old /signup URLs and /login?mode=signup → /start (lean signup wizard).
  // Preserves any tracking/utm params through the redirect.
  const isLegacySignupPath = pathname === "/signup" || pathname.startsWith("/signup/");
  const isLegacyLoginSignup =
    pathname === "/login" && request.nextUrl.searchParams.get("mode") === "signup";
  if (isLegacySignupPath || isLegacyLoginSignup) {
    const startUrl = new URL("/start", request.url);
    request.nextUrl.searchParams.forEach((val, key) => {
      if (key !== "mode") startUrl.searchParams.set(key, val);
    });
    return NextResponse.redirect(startUrl);
  }

  // Check for auth token in cookies (we'll also check localStorage client-side)
  // Note: localStorage is not accessible in middleware, so we use a cookie for server-side check
  const token = request.cookies.get("admin_auth_token")?.value;

  // Check if the current route is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Check if the current route is an auth route (login, etc.)
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // If user is on auth route and has token, redirect to dashboard
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If route requires auth and no token, redirect to login with callback
  if (!isPublicRoute && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", encodeURIComponent(pathname + request.nextUrl.search));

    // Preserve UTM/tracking params through the redirect so they aren't lost
    const trackingKeys = [
      "ref", "click_id", "utm_source", "utm_medium", "utm_campaign",
      "utm_content", "utm_term", "utm_channel", "utm_adset", "utm_matchtype",
      "gclid", "fbclid", "msclkid", "li_fat_id", "twclid", "ttclid", "dclid",
    ];
    for (const key of trackingKeys) {
      const val = request.nextUrl.searchParams.get(key);
      if (val) loginUrl.searchParams.set(key, val);
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - api routes
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)",
  ],
};
