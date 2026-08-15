import "server-only";

type HoldenHealthEmailInput = {
  firstName: string;
  preheader: string;
  heading: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  unsubscribeToken?: string | null;
  isPreview?: boolean;
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function paragraphs(value: string) {
  return value.trim().split(/\n\s*\n/).map((paragraph) => `<p style="margin:0 0 20px;color:#4e4a60;font-size:17px;line-height:1.7">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
}

export function renderHoldenHealthEmail(input: HoldenHealthEmailInput) {
  const unsubscribeUrl = input.unsubscribeToken ? `https://portal.holden.health/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}` : null;
  const button = input.ctaLabel && input.ctaUrl
    ? `<p style="margin:30px 0"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#5d4a91;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">${escapeHtml(input.ctaLabel)}</a></p>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Holden Health</title></head><body style="margin:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;color:#27243d"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f5f0"><tr><td align="center" style="padding:30px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;overflow:hidden;border:1px solid #e5e0ec;border-radius:26px;background:#ffffff"><tr><td style="padding:34px 38px;background:linear-gradient(135deg,#e3f6f1,#eee8fa)"><div style="color:#5d4a91;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase">Holden Health</div><div style="margin-top:18px;color:#27243d;font-size:34px;font-weight:800;line-height:1.1">${escapeHtml(input.heading)}</div><div style="margin-top:12px;color:#6d687d;font-size:15px;line-height:1.5">Stronger together. Better every day.</div></td></tr><tr><td style="padding:36px 38px"><p style="margin:0 0 20px;color:#27243d;font-size:18px;font-weight:700">Hi ${escapeHtml(input.firstName || "there")},</p>${paragraphs(input.body)}${button}<p style="margin:32px 0 0;color:#27243d;font-size:17px;line-height:1.6">You’ve got this,<br><strong>Kelsey</strong></p></td></tr><tr><td style="padding:24px 38px;border-top:1px solid #ece8f0;background:#fbfaf6;color:#777184;font-size:12px;line-height:1.6"><strong style="color:#5d4a91">Holden Health LLC</strong><br>Plymouth, Michigan${input.isPreview ? "<br><em>This is an admin preview.</em>" : unsubscribeUrl ? `<br><a href="${unsubscribeUrl}" style="color:#6d687d">Stop receiving member communications</a>` : ""}</td></tr></table></td></tr></table></body></html>`;
}

export function renderHoldenHealthText(input: HoldenHealthEmailInput) {
  const lines = [`${input.heading}`, "", `Hi ${input.firstName || "there"},`, "", input.body.trim()];
  if (input.ctaLabel && input.ctaUrl) lines.push("", `${input.ctaLabel}: ${input.ctaUrl}`);
  lines.push("", "You’ve got this,", "Kelsey", "", "Holden Health LLC · Plymouth, Michigan");
  if (input.unsubscribeToken) lines.push(`Manage email preferences: https://portal.holden.health/unsubscribe?token=${input.unsubscribeToken}`);
  return lines.join("\n");
}
