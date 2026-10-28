import { next, rewrite } from "@vercel/functions";

export default function publicSite(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    return Response.redirect("https://portal.holden.health/admin/login", 307);
  }

  if (["/preview.html", "/preview-access"].includes(url.pathname)) {
    return Response.redirect("https://www.holden.health/", ["GET", "HEAD"].includes(request.method) ? 308 : 303);
  }

  if (url.hostname === "holden.health") {
    url.hostname = "www.holden.health";
    return Response.redirect(url, 308);
  }

  if (/^\/pages\/[a-z0-9][a-z0-9-]{1,62}\/?$/.test(url.pathname)) {
    const templateUrl = new URL("/custom-page.html", request.url);
    templateUrl.search = url.search;
    return rewrite(templateUrl);
  }
  return next();
}

export const config = {
  matcher: "/:path*",
  runtime: "edge",
};
