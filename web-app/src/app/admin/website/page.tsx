import { weeklyScheduleSlots } from "@/lib/class-schedule";
import {normalizeHeader} from "@/lib/website-header";
import { createWebsitePage, reorderWebsitePage, updateDropInVisibility } from "@/app/actions";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import WebsiteEditor from "./editor";

import { getWebsitePage, normalizeWebsiteSettings, websitePagesForSettings, type WebsitePageKey } from "@/lib/website-pages";

type WebsitePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type WebsiteEditorContent = Record<WebsitePageKey, Record<string, string> & { published_at: string }>;

export default async function WebsiteEditorPage({ searchParams }: WebsitePageProps) {
  const admin = await verifyAdmin();
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : "";
  const supabase = await createClient();
  const { data: settingsRecord, error: settingsError } = await supabase.from("site_content").select("value,updated_at").eq("content_key", "website:settings").maybeSingle();
  const settings = normalizeWebsiteSettings(settingsRecord?.value);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data: futurePrograms } = await supabase.from("sessions").select("id,name,starts_on,ends_on,description,new_member_price_cents,returning_member_price_cents,two_day_price_cents,three_day_price_cents").eq("published", true).eq("status", "enrolling").gt("starts_on", today).order("starts_on");
  const featuredProgram = futurePrograms?.find(program => program.id === settings.featured_session_id) ?? futurePrograms?.[0];
  const pages = websitePagesForSettings(settings);
  const initialPage = getWebsitePage(typeof params.page === "string" ? params.page : "", pages)?.key ?? "homepage";
  const [{ data: managed, error: managedError }, { data: legacyHomepage, error: legacyError }] = await Promise.all([
    supabase.from("site_content").select("content_key,value,published_at,updated_at").in("content_key", pages.map((page) => `website:${page.key}`)),
    supabase.from("website_content").select("*").eq("page_key", "homepage").maybeSingle(),
  ]);
  const {data: headerRecord, error: headerError} = await supabase.from("site_content").select("value,updated_at").eq("content_key","website:header").maybeSingle();
  if(settingsError || managedError || legacyError || headerError) throw new Error("Published website content could not be loaded. Please refresh before editing.");
  const dropInVisible = settings.drop_in_visible;
  const content = Object.fromEntries(pages.map((page) => {
    const record = managed?.find((item) => item.content_key === `website:${page.key}`);
    const legacy = page.key === "homepage" && legacyHomepage ? legacyHomepage : {};
    return [page.key, { visual_overrides: "[]", custom_sections: "[]", ...page.defaults, ...legacy, ...((record?.value as Record<string, string> | null) ?? {}), published_at: record?.published_at ?? legacyHomepage?.published_at ?? record?.updated_at ?? new Date().toISOString() }];
  })) as WebsiteEditorContent;
  const {data: storedDraft, error: draftError} = await supabase.from("website_editor_drafts").select("payload,revision").eq("user_id",admin.userId).maybeSingle();
  if(draftError) throw new Error("The website drafts could not be loaded. Please refresh.");
  const programs = await Promise.all((futurePrograms ?? []).map(async program => {
    const {data: meetings} = await supabase.from("class_meetings").select("starts_at,cancelled").eq("session_id",program.id).order("starts_at");
    return {...program, format: program.two_day_price_cents != null && program.three_day_price_cents != null ? "weekly" : "all-classes", first_price_cents: program.two_day_price_cents ?? program.new_member_price_cents, second_price_cents: program.three_day_price_cents ?? program.returning_member_price_cents ?? program.new_member_price_cents, class_times: weeklyScheduleSlots(meetings ?? [])};
  }));
  const bases = Object.fromEntries(pages.map(page=>[`website:${page.key}`,managed?.find(row=>row.content_key===`website:${page.key}`)?.updated_at ?? null]));
  bases["website:header"]=headerRecord?.updated_at ?? null;
  bases["website:settings"]=settingsRecord?.updated_at ?? null;

  return <main className="app-shell admin-shell website-editor-shell">
    <header className="workspace-page-header"><div><Link className="back-link" href="/admin/content">← Content</Link><span className="eyebrow">Public website</span><h1>Edit your website</h1><p>Edit your page, preview the result, then publish when you are ready.</p></div><div className="workspace-header-actions"><a className="button secondary" href="https://www.holden.health/" target="_blank" rel="noreferrer">View live website ↗</a></div></header>
    {message === "published" ? <p className="notice success" role="status">Website changes published successfully. They may take a few seconds to appear.</p> : null}
    {message === "publish-failed" ? <p className="notice error" role="alert">The website changes did not publish. Please try again.</p> : null}
    {message === "drop-in-hidden" ? <p className="notice success" role="status">Drop-in booking is now hidden across the public website.</p> : null}
    {message === "drop-in-shown" ? <p className="notice success" role="status">Drop-in booking is visible again across the public website.</p> : null}
    {message === "drop-in-update-failed" ? <p className="notice error" role="alert">The drop-in setting did not update. Please try again.</p> : null}
    {message === "page-created" ? <p className="notice success" role="status">Your new page was created and added to the website menu.</p> : null}
    {message === "page-create-failed" ? <p className="notice error" role="alert">The new page could not be created. Check the name and URL, then try again.</p> : null}
    {message === "page-reordered" ? <p className="notice success" role="status">The page order was updated.</p> : null}
    {message === "page-reorder-failed" ? <p className="notice error" role="alert">The page order could not be updated. Please try again.</p> : null}
    {message === "feature-published" ? <p className="notice success" role="status">The featured class program is live on the homepage and Coaching page.</p> : null}
    {message === "feature-unavailable" || message === "feature-failed" ? <p className="notice error" role="alert">The featured program could not be published. Check that it is visible and accepting registrations.</p> : null}

    <WebsiteEditor pages={pages} content={content} initialPage={initialPage} header={normalizeHeader(headerRecord?.value)} programs={programs} featuredId={featuredProgram?.id ?? ""} featuredCopy={{sessionId: settings.featured_session_id, headline:settings.featured_headline,body:settings.featured_body,button:settings.featured_button}} bases={bases} savedDraft={storedDraft?.payload ?? null} draftRevision={Number(storedDraft?.revision ?? 0)} dropInVisible={dropInVisible} />
    <details className="panel website-management"><summary>Manage pages and website settings</summary>
    <p>These settings are separate from your page draft. Their buttons apply the stated change immediately.</p>
    <section className="panel">
      <h2>Free 14-Day Challenge</h2>
      <p>Edit the challenge page headings, signup text, buttons, and “A little support at home” section. Program details and Kelsey’s note are available in the same editor.</p>
      <Link className="button primary" href="/admin/challenges?edit=wording#page-wording">Edit the free challenge page</Link>
    </section>

    <section className="panel website-availability-control">
      <div><span className="eyebrow">Temporary website setting</span><h2>Drop-in booking</h2><p>{dropInVisible ? "Drop-in buttons and invitations are currently visible." : "Drop-in buttons and invitations are currently hidden. The booking page and past requests are not deleted."}</p></div>
      <form action={updateDropInVisibility}><input type="hidden" name="visible" value={dropInVisible ? "false" : "true"} /><button className={`button ${dropInVisible ? "secondary" : "primary"}`} type="submit">{dropInVisible ? "Hide drop-in booking" : "Bring back drop-in booking"}</button></form>
    </section>

    <section className="panel website-page-manager">
      <div className="website-page-manager-heading"><div><span className="eyebrow">Pages and menu</span><h2>Arrange or add pages</h2><p>Move pages into the order you want. This controls the editor order and links within menu groups. The compact header keeps Coaching, About, Resources, and The App in place; custom pages appear under Resources.</p></div></div>
      <div className="website-page-order-list">{pages.map((page, index) => <div className="website-page-order-item" key={page.key}><div><strong>{page.label}</strong><small>{page.pathname}</small></div><div className="website-page-order-actions"><Link href={`/admin/website?page=${encodeURIComponent(page.key)}`}>Edit</Link><form action={reorderWebsitePage}><input type="hidden" name="pageKey" value={page.key} /><input type="hidden" name="direction" value="up" /><button type="submit" disabled={index === 0} aria-label={`Move ${page.label} up`}>↑</button></form><form action={reorderWebsitePage}><input type="hidden" name="pageKey" value={page.key} /><input type="hidden" name="direction" value="down" /><button type="submit" disabled={index === pages.length - 1} aria-label={`Move ${page.label} down`}>↓</button></form></div></div>)}</div>
      <form className="website-add-page-form" action={createWebsitePage}><div><strong>Add a new page</strong><p>It starts with a branded headline, introduction, button, and room for any sections Kelsey adds.</p></div><label>Page name<input name="pageName" maxLength={80} placeholder="Example: Corporate Wellness" required /></label><label>Page URL<input name="pageSlug" maxLength={63} placeholder="corporate-wellness" pattern="[a-z0-9][a-z0-9-]+" required /><small>Lowercase letters, numbers, and hyphens only.</small></label><button className="button primary" type="submit">Create page</button></form>
    </section>

    </details>
  </main>;
}
