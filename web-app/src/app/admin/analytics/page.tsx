import EmailHistoryList from "./email-history";
import Link from "next/link";
import { verifyAdmin } from "@/lib/auth";
import { getEmailHistory, getEmailSummary, getTrafficSummary } from "./data";
import { resolveAnalyticsRange } from "./range";
import RefreshButton from "./refresh-button";

type AnalyticsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const number = new Intl.NumberFormat("en-US");
const refreshedAtFormat = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit",
});

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <div className="analytics-stat"><span>{label}</span><strong>{typeof value === "number" ? number.format(value) : value}</strong>{note ? <small>{note}</small> : null}</div>;
}

function ProviderNotice({ provider, status }: { provider: string; status: "not_configured" | "error" }) {
  return <div className="analytics-notice" role="status"><strong>{provider} data is unavailable.</strong><p>{status === "not_configured" ? "A reporting connection still needs to be set up." : "Please try Refresh data in a moment. If this continues, the reporting connection needs attention."}</p></div>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  await verifyAdmin();
  const params = await searchParams;
  const checkedAt = new Date();
  const range = resolveAnalyticsRange(params, checkedAt);
  const [traffic, email] = await Promise.all([getTrafficSummary(range.start, range.end), getEmailSummary(range.start, range.end)]);

  const history = await getEmailHistory(range.start, range.end);

  return <main className="app-shell admin-shell workspace-page analytics-page">
    <header className="workspace-page-header analytics-header"><div><span className="eyebrow">Business activity</span><h1>Analytics</h1><p>See how people find Holden Health, use the portal, and respond to email.</p></div><div className="analytics-header-actions"><span className="analytics-updated">Checked {refreshedAtFormat.format(checkedAt)}</span><RefreshButton /></div></header>

    <div className="analytics-range-wrap"><nav className="analytics-range" aria-label="Analytics date range"><span>Showing</span><Link className={range.selected === "24h" ? "active" : ""} aria-current={range.selected === "24h" ? "page" : undefined} href="/admin/analytics?hours=24">Last 24 hours</Link>{([7, 30, 90] as const).map((days) => <Link key={days} className={range.selected === days ? "active" : ""} aria-current={range.selected === days ? "page" : undefined} href={`/admin/analytics?days=${days}`}>Last {days} days</Link>)}</nav>
      <form className="analytics-custom-range" action="/admin/analytics" method="get"><label htmlFor="analytics-start">From</label><input id="analytics-start" name="start" type="date" max={range.today} defaultValue={range.startDate} required /><label htmlFor="analytics-end">To</label><input id="analytics-end" name="end" type="date" max={range.today} defaultValue={range.endDate} required /><button type="submit">Apply dates</button></form>
    </div>
    {range.invalid ? <p className="analytics-range-error" role="alert">Choose dates in order, up to one year apart, with the end date no later than today. Showing the last {range.selected} days instead.</p> : null}

    <section className="analytics-section" aria-labelledby="analytics-website-heading"><div className="analytics-section-heading"><div><span className="eyebrow">PostHog</span><h2 id="analytics-website-heading">Website & portal</h2><p>Visits and key actions during the selected period.</p></div></div>
      {traffic.status === "ok" ? <><div className="analytics-stat-grid">
        <Stat label="Website visitors" value={traffic.data.websiteVisitors} note="Unique tracked visitors on holden.health" />
        <Stat label="Website pageviews" value={traffic.data.websitePageviews} note="Pages opened" />
        <Stat label="Portal visitors" value={traffic.data.portalVisitors} note="Unique tracked visitors" />
        <Stat label="Portal pageviews" value={traffic.data.portalPageviews} note="Pages opened" />
      </div><div className="analytics-lower-grid"><div className="panel analytics-panel"><h3>Key actions</h3><dl className="analytics-rows"><div><dt>Website forms submitted</dt><dd>{number.format(traffic.data.websiteForms)}</dd></div><div><dt>Class checkout starts</dt><dd>{number.format(traffic.data.checkoutStarts)}</dd></div><div><dt>Challenge joins</dt><dd>{number.format(traffic.data.challengeJoins)}</dd></div></dl><p className="analytics-footnote">These count recorded actions, not completed payments or confirmed bookings.</p></div><div className="panel analytics-panel"><h3>Top website pages</h3>{traffic.data.topPages.length ? <ol className="analytics-top-pages">{traffic.data.topPages.map((page) => <li key={page.path}><span>{page.path}</span><strong>{number.format(page.pageviews)}</strong></li>)}</ol> : <p className="analytics-empty">No website pageviews in this period.</p>}</div></div></> : <ProviderNotice provider="PostHog" status={traffic.status} />}
    </section>

    <section className="analytics-section" aria-labelledby="analytics-email-heading"><div className="analytics-section-heading"><div><span className="eyebrow">Resend</span><h2 id="analytics-email-heading">Email performance</h2><p>All Holden Health emails sent through Resend, including member updates and automatic messages.</p></div><Link className="text-link" href="/admin/communications">Campaign history →</Link></div>
      {email.status === "ok" ? <><div className="analytics-stat-grid">
        <Stat label="Sent" value={email.data.sent} note="Sent to mail servers" />
        <Stat label="Delivered" value={email.data.delivered} note={email.data.sent ? `${Math.round(email.data.delivered / email.data.sent * 100)}% of sent` : "Accepted by mail servers"} />
        <Stat label="Recorded opens" value={email.data.uniqueOpened} note="Emails with a tracked open" />
        <Stat label="Recorded clicks" value={email.data.uniqueClicked} note="Emails with a tracked link click" />
      </div>{email.data.trackingReady === false ? <div className="analytics-notice analytics-tracking-notice" role="status"><strong>Open and click tracking needs setup.</strong><p>Resend has not verified the tracking DNS record for mail.holden.health. These counts may be lower than actual engagement; delivery totals are still available.</p></div> : null}<div className="panel analytics-email-health"><h3>Delivery issues</h3><div><span><strong>{number.format(email.data.failed)}</strong> failed</span><span><strong>{number.format(email.data.bounced)}</strong> bounced</span><span><strong>{number.format(email.data.complained)}</strong> spam complaints</span></div></div><p className="analytics-footnote">Open counts are estimates because email apps can load tracking images automatically. Resend may take up to 15 minutes to refresh these totals.</p></> : <ProviderNotice provider="Resend" status={email.status} />}
      {history.status === "ok" ? <EmailHistoryList history={history.data} /> : <ProviderNotice provider="Email history" status={history.status} />}
    </section>
  </main>;
}
