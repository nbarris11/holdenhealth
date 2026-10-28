import "server-only";

type ProviderResult<T> = { status: "ok"; data: T } | { status: "not_configured" | "error" };

export type TrafficSummary = {
  websiteVisitors: number;
  websitePageviews: number;
  portalVisitors: number;
  portalPageviews: number;
  websiteForms: number;
  checkoutStarts: number;
  challengeJoins: number;
  topPages: { path: string; pageviews: number }[];
};

export type EmailSummary = {
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  complained: number;
  uniqueOpened: number;
  uniqueClicked: number;
  trackingReady: boolean | null;
};

type QueryResponse = { results?: unknown; error?: string };

const posthogProjectId = "605056";
const websiteHosts = "('holden.health', 'www.holden.health')";
const resendDomainId = "7a6d344d-2861-4421-b78f-e46d287b7e73";

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function posthogQuery(query: string, apiKey: string): Promise<unknown[][]> {
  const response = await fetch(`https://us.posthog.com/api/projects/${posthogProjectId}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query }, name: "Holden Health admin analytics" }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`PostHog query failed: ${response.status}`);
  const payload = await response.json() as QueryResponse;
  if (payload.error) throw new Error("PostHog returned an error");
  if (!Array.isArray(payload.results)) throw new Error("PostHog returned no usable SQL results");
  return payload.results;
}

export async function getTrafficSummary(start: Date, end: Date): Promise<ProviderResult<TrafficSummary>> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!apiKey) return { status: "not_configured" };

  // Dates are generated on the server; no visitor input is interpolated into HogQL.
  const range = `timestamp >= toDateTime('${start.toISOString()}') AND timestamp < toDateTime('${end.toISOString()}')`;
  try {
    const [trafficRows, actionRows, topPageRows] = await Promise.all([
      posthogQuery(`
        SELECT site, uniq(session_person_id) AS visitors, sum(views) AS views
        FROM (
          SELECT if(properties.$host = 'portal.holden.health', 'portal', 'website') AS site,
            properties.$session_id AS session_id, any(person_id) AS session_person_id, count() AS views
          FROM events
          WHERE ${range}
            AND event IN ('$pageview', '$screen')
            AND properties.$host IN ('holden.health', 'www.holden.health', 'portal.holden.health')
            AND events.$session_id_uuid IS NOT NULL
          GROUP BY site, session_id
        )
        GROUP BY site
      `, apiKey),
      posthogQuery(`
        SELECT event, count() AS total
        FROM events
        WHERE ${range}
          AND event IN ('website_form_submitted', 'enrollment_checkout_started', 'challenge_joined')
        GROUP BY event
        LIMIT 10
      `, apiKey),
      posthogQuery(`
        SELECT properties.$pathname AS path, count() AS pageviews
        FROM events
        WHERE ${range}
          AND event = '$pageview'
          AND properties.$host IN ${websiteHosts}
        GROUP BY path
        ORDER BY pageviews DESC
        LIMIT 5
      `, apiKey),
    ]);

    const summary: TrafficSummary = {
      websiteVisitors: 0, websitePageviews: 0,
      portalVisitors: 0, portalPageviews: 0,
      websiteForms: 0, checkoutStarts: 0, challengeJoins: 0, topPages: [],
    };
    // PostHog Web Analytics counts one person per session. The typed overview API
    // rounds custom timestamps to whole dates; this keeps the selected Detroit bounds.
    for (const [site, visitors, views] of trafficRows) {
      if (site === "website") {
        summary.websiteVisitors = count(visitors);
        summary.websitePageviews = count(views);
      } else if (site === "portal") {
        summary.portalVisitors = count(visitors);
        summary.portalPageviews = count(views);
      }
    }
    for (const [event, total] of actionRows) {
      if (event === "website_form_submitted") summary.websiteForms += count(total);
      else if (event === "enrollment_checkout_started") summary.checkoutStarts += count(total);
      else if (event === "challenge_joined") summary.challengeJoins += count(total);
    }
    summary.topPages = topPageRows
      .filter((row) => typeof row[0] === "string" && row[0].startsWith("/"))
      .map((row) => ({ path: String(row[0]), pageviews: count(row[1]) }));
    return { status: "ok", data: summary };
  } catch (error) {
    console.error("Admin analytics: PostHog is unavailable", error instanceof Error ? error.message : "Unknown error");
    return { status: "error" };
  }
}

async function resendTrackingReady(apiKey: string): Promise<boolean | null> {
  try {
    const response = await fetch(`https://api.resend.com/domains/${resendDomainId}`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const domain = await response.json() as {
      open_tracking?: boolean; click_tracking?: boolean;
      records?: { record?: string; type?: string; status?: string }[];
    };
    const trackingRecord = domain.records?.find((record) => record.record === "Tracking" && record.type === "CNAME");
    if (!trackingRecord) return null;
    return domain.open_tracking === true && domain.click_tracking === true && trackingRecord.status === "verified";
  } catch {
    return null;
  }
}

export async function getEmailSummary(start: Date, end: Date): Promise<ProviderResult<EmailSummary>> {
  const apiKey = process.env.RESEND_REPORTING_API_KEY;
  if (!apiKey) return { status: "not_configured" };
  const url = new URL("https://api.resend.com/emails/metrics");
  url.searchParams.set("start_date", start.toISOString());
  url.searchParams.set("end_date", end.toISOString());
  try {
    const [response, trackingReady] = await Promise.all([fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    }), resendTrackingReady(apiKey)]);
    if (!response.ok) throw new Error(`Resend metrics failed: ${response.status}`);
    const payload = await response.json() as { totals?: Record<string, unknown> };
    if (!payload.totals) throw new Error("Resend returned no totals");
    const totals = payload.totals;
    return { status: "ok", data: {
      sent: count(totals.sent), delivered: count(totals.delivered), failed: count(totals.failed),
      bounced: count(totals.bounced), complained: count(totals.complained),
      uniqueOpened: count(totals.unique_opened), uniqueClicked: count(totals.unique_clicked),
      trackingReady,
    } };
  } catch (error) {
    console.error("Admin analytics: Resend is unavailable", error instanceof Error ? error.message : "Unknown error");
    return { status: "error" };
  }
}

export type EmailHistoryRow = { id: string; to: string[]; subject: string; createdAt: string; status: string };
export type EmailHistory = { rows: EmailHistoryRow[]; truncated: boolean };

/** Read provider history, including transactional mail that never created a campaign. */
export async function getEmailHistory(start: Date, end: Date): Promise<ProviderResult<EmailHistory>> {
  const apiKey = process.env.RESEND_REPORTING_API_KEY;
  if (!apiKey) return { status: "not_configured" };
  const rows: EmailHistoryRow[] = [], seen = new Set<string>();
  let after = "";
  try {
    // Bound provider work. Never present a truncated scan as complete history.
    for (let page = 0; page < 5; page++) {
      const url = new URL("https://api.resend.com/emails");
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);
      let response: Response | undefined;
      for (let retry = 0; retry < 3; retry++) {
        response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (response.status !== 429) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!response?.ok) throw new Error("Email history request failed");
      const payload = await response.json() as { data?: { id: string; to: string[]; subject: string; created_at: string; last_event: string }[]; has_more?: boolean };
      if (!Array.isArray(payload.data)) throw new Error("Invalid email history response");
      let reachedStart = false;
      for (const row of payload.data) {
        const timestamp = new Date(row.created_at).getTime();
        if (!Number.isFinite(timestamp) || typeof row.id !== "string" || !Array.isArray(row.to)) throw new Error("Invalid email history row");
        if (timestamp < start.getTime()) reachedStart = true;
        if (timestamp < start.getTime() || timestamp >= end.getTime() || seen.has(row.id)) continue;
        seen.add(row.id);
        rows.push({ id: row.id, to: row.to.filter(to => typeof to === "string"), subject: row.subject || "(No subject)", createdAt: new Date(timestamp).toISOString(), status: row.last_event || "unknown" });
      }
      if (!payload.has_more || reachedStart) return { status: "ok", data: { rows, truncated: false } };
      const cursor = payload.data.at(-1)?.id;
      if (!cursor || cursor === after) throw new Error("Email history pagination stalled");
      after = cursor;
    }
    return { status: "ok", data: { rows, truncated: true } };
  } catch {
    return { status: "error" };
  }
}
