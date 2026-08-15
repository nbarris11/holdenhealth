import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headersToSet).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const isPublicAdminLogin = path === "/admin/login";
  const isProtected = path.startsWith("/portal") || (path.startsWith("/admin") && !isPublicAdminLogin);

  if (isProtected && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    if (path.startsWith("/admin")) {
      loginUrl.pathname = "/admin/login";
      loginUrl.search = "";
    } else {
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", path);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (path === "/login" && isAuthenticated) {
    const portalUrl = request.nextUrl.clone();
    portalUrl.pathname = "/portal";
    portalUrl.search = "";
    return NextResponse.redirect(portalUrl);
  }

  return response;
}
