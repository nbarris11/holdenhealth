/** Keep staff sign-in destinations inside the admin workspace. */
export function adminReturnPath(value: unknown): string {
  if (typeof value !== "string" || /[\\\x00-\x20]/.test(value)) return "/admin";
  try {
    const url = new URL(value, "https://portal.holden.health");
    if (!value.startsWith("/admin") || url.origin !== "https://portal.holden.health"
      || !(url.pathname === "/admin" || url.pathname.startsWith("/admin/"))
      || url.pathname === "/admin/login") return "/admin";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/admin";
  }
}

export function adminLoginPath(next: unknown, error?: string): string {
  const params = new URLSearchParams({ next: adminReturnPath(next) });
  if (error) params.set("error", error);
  return `/admin/login?${params}`;
}
