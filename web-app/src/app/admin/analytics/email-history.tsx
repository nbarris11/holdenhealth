"use client";
import { useState } from "react";
import type { EmailHistory } from "./data";

const statuses: Record<string, string> = { sent: "Sent", delivered: "Delivered", opened: "Opened", clicked: "Clicked", bounced: "Bounced", complained: "Spam complaint", delivery_delayed: "Delayed", failed: "Failed", suppressed: "Suppressed", scheduled: "Scheduled", canceled: "Cancelled", queued: "Queued", unknown: "Status unavailable" };
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });

export default function EmailHistoryList({ history }: { history: EmailHistory }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const rows = history.rows.filter(row => `${row.to.join(" ")} ${row.subject}`.toLowerCase().includes(query));
  return <div className="panel analytics-email-history">
    <h3>Individual email history</h3>
    <p>Welcome emails, intake links, bills, and campaigns. Times are Eastern. Status is the latest event reported by Resend.</p>
    <label className="stack-form">Search by recipient or subject<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name in email address, email, or subject" /></label>
    {history.truncated && <p className="notice warning">This search covers the newest 500 emails checked. Older emails may be missing. <a href="https://resend.com/emails" target="_blank" rel="noreferrer">Open full history in Resend</a>.</p>}
    <p role="status">{rows.length} matching email{rows.length === 1 ? "" : "s"} in the loaded history for this period.</p>
    <div className="analytics-mail-list">{rows.map(row => <article key={row.id} className="analytics-mail-row">
      <div><strong>{row.subject}</strong><p>{row.to.join(", ")}</p><time dateTime={row.createdAt}>{date.format(new Date(row.createdAt))}</time></div>
      <div><span className={`status-pill ${["delivered", "opened", "clicked"].includes(row.status) ? "success" : ["failed", "bounced", "suppressed", "complained"].includes(row.status) ? "warning" : "neutral"}`}>{statuses[row.status.replace(/^email\./, "")] || row.status.replaceAll("_", " ")}</span><a href={`https://resend.com/emails/${encodeURIComponent(row.id)}`} target="_blank" rel="noreferrer" aria-label={`View ${row.subject} in Resend`}>View in Resend →</a></div>
    </article>)}</div>
    {!rows.length && <p>No emails match this search in the loaded history. Try another search or date range.</p>}
    <p className="analytics-footnote">Delivered means the receiving mail server accepted the email; it may still be in junk mail. An absent open or click does not prove the recipient hasn’t read it.</p>
  </div>;
}
