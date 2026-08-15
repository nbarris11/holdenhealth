import { next, rewrite } from "@vercel/functions";

const ACCESS_COOKIE = "holden_preview_access";
const ACCESS_DURATION_SECONDS = 60 * 60 * 24 * 7;

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const prefix = `${name}=`;

  for (const cookie of cookieHeader.split(";")) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }

  return "";
}

function previewPage(request: Request, hasError = false) {
  const url = new URL("/preview.html", request.url);
  if (hasError) {
    url.searchParams.set("error", "1");
    return Response.redirect(url, 303);
  }

  return rewrite(url);
}

export default async function previewGate(request: Request) {
  const url = new URL(request.url);
  const password = process.env.PREVIEW_PASSWORD;

  if (url.pathname === "/preview.html" || url.pathname === "/assets/logo.png" || url.pathname === "/favicon.ico") {
    return next();
  }

  if (url.pathname === "/preview-access") {
    if (request.method !== "POST" || !password) return previewPage(request, true);

    const formData = await request.formData();
    const submittedPassword = String(formData.get("password") ?? "");
    const [submittedDigest, passwordDigest] = await Promise.all([
      digest(submittedPassword),
      digest(password),
    ]);

    if (submittedDigest !== passwordDigest) return previewPage(request, true);

    return new Response(null, {
      status: 303,
      headers: {
        Location: "/",
        "Set-Cookie": `${ACCESS_COOKIE}=${passwordDigest}; Path=/; Max-Age=${ACCESS_DURATION_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (!password) return previewPage(request);

  const expectedCookie = await digest(password);
  if (cookieValue(request, ACCESS_COOKIE) === expectedCookie) return next();

  return previewPage(request);
}

export const config = {
  matcher: "/:path*",
  runtime: "edge",
};
