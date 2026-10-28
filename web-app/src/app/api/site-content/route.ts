import {normalizeHeader} from "@/lib/website-header";
import { createClient } from "@/lib/supabase/server";
import { weeklyScheduleSlots } from "@/lib/class-schedule";
import { getWebsitePage, normalizeWebsiteSettings, websiteNavigationForSettings, websitePagesForSettings } from "@/lib/website-pages";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();
  const { data: settingsRecord, error: settingsError } = await supabase.from("site_content").select("value").eq("content_key", "website:settings").eq("published", true).maybeSingle();
  if (settingsError) return Response.json({ error: "Website settings unavailable." }, { status: 503, headers: { "Access-Control-Allow-Origin": "*" } });
  const settings = normalizeWebsiteSettings(settingsRecord?.value);
  const pages = websitePagesForSettings(settings);
  if (url.searchParams.get("navigation") === "1") {
    const {data: header, error: headerError} = await supabase.from("site_content").select("value").eq("content_key","website:header").eq("published",true).maybeSingle();
    if (headerError) return Response.json({error:"Header unavailable"},{status:503,headers:{"Access-Control-Allow-Origin":"*"}});
    return Response.json({ pages: websiteNavigationForSettings(settings), header:normalizeHeader(header?.value) }, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
  }
  const page = getWebsitePage(url.searchParams.get("page") ?? "homepage", pages);
  if (!page) return Response.json({ error: "Unknown website page." }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [{ data: managed, error }, { data: legacy }, { data: session }, { data: futurePrograms }] = await Promise.all([
    supabase.from("site_content").select("value,published_at").eq("content_key", `website:${page.key}`).eq("published", true).maybeSingle(),
    page.key === "homepage" ? supabase.from("website_content").select("hero_eyebrow,hero_heading,hero_body,primary_cta_label,primary_cta_url,secondary_cta_label,secondary_cta_url,offer_eyebrow,offer_heading,offer_body,offer_cta_label,offer_cta_url,final_heading,final_body,final_cta_label,final_cta_url,published_at").eq("page_key", "homepage").maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("sessions").select("id").in("status", ["enrolling", "active"]).eq("published", true).order("starts_on").limit(1).maybeSingle(),
    ["homepage", "coaching"].includes(page.key) ? supabase.from("sessions").select("id,name,description,starts_on,ends_on,new_member_price_cents,returning_member_price_cents,two_day_price_cents,three_day_price_cents").eq("published", true).eq("status", "enrolling").gt("starts_on", today).order("starts_on") : Promise.resolve({ data: [] }),
  ]);
  if (error) return Response.json({ error: "Website content unavailable." }, { status: 503, headers: { "Access-Control-Allow-Origin": "*" } });
  const content: Record<string, unknown> = { visual_overrides: "[]", custom_sections: "[]", ...page.defaults, ...(legacy ?? {}), ...((managed?.value as Record<string, string> | null) ?? {}) };
  const { data: meetings } = page.key === "homepage" && session ? await supabase.from("class_meetings").select("starts_at,cancelled").eq("session_id", session.id).order("starts_at") : { data: [] };
  const featured = futurePrograms?.find(program => program.id === settings.featured_session_id) ?? futurePrograms?.[0];
  const { data: featuredMeetings } = featured ? await supabase.from("class_meetings").select("starts_at,cancelled").eq("session_id", featured.id).order("starts_at") : { data: [] };
  const existingPromoMatches = Boolean(featured && String(content.mini_cta_url ?? "").includes(`session=${featured.id}`));
  const featuredProgram = featured ? {
    id: featured.id, name: featured.name, description: featured.description, starts_on: featured.starts_on, ends_on: featured.ends_on,
    format: featured.two_day_price_cents != null && featured.three_day_price_cents != null ? "weekly" : "all-classes",
    first_price_cents: featured.two_day_price_cents ?? featured.new_member_price_cents,
    second_price_cents: featured.three_day_price_cents ?? featured.returning_member_price_cents ?? featured.new_member_price_cents,
    class_times: weeklyScheduleSlots(featuredMeetings ?? []),
    headline: settings.featured_session_id === featured.id ? settings.featured_headline : existingPromoMatches ? String(content.mini_heading ?? "") : "",
    body: settings.featured_session_id === featured.id ? settings.featured_body : existingPromoMatches ? String(content.mini_body ?? "") : "",
    button: settings.featured_session_id === featured.id ? settings.featured_button : existingPromoMatches ? String(content.mini_cta_label ?? "") : "",
  } : null;
  return Response.json({ ...content, page_key: page.key, drop_in_visible: settings.drop_in_visible, featured_program: featuredProgram, published_at: managed?.published_at ?? legacy?.published_at, ...(page.key === "homepage" ? { class_schedule: weeklyScheduleSlots(meetings ?? []) } : {}) }, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
}
