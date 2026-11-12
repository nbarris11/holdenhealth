export async function verifyContactCheck(token: FormDataEntryValue | null, origin: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || typeof token !== "string" || !token || token.length > 2048) return false;

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return false;

  const result = await response.json();
  return result.success === true && result.action === "contact" && result.hostname === new URL(origin).hostname;
}
