import Link from "next/link";
import CommunicationComposer from "./composer";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type CommunicationsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Campaign = { id: string; kind: string; audience: string; subject: string; status: string; recipient_count: number; sent_count: number; failed_count: number; sent_at: string | null; created_at: string };
type Enrollment = { member_id: string; weekly_commitment: number | null };

const messages: Record<string, string> = {
  "preview-sent": "Preview sent to your admin email.", "preview-failed": "The preview could not be sent.", sent: "Communication sent to members.",
  "send-failed": "The email provider could not send this communication.", "missing-fields": "Complete the subject, heading, and message.",
  "invalid-button": "Add both button text and a complete button link, or leave both blank.", "email-not-configured": "Email delivery is not configured.",
  "confirm-send": "Check the confirmation box before sending to members.", "recipient-error": "The member list could not be loaded.",
  "no-recipients": "There are no opted-in members in that audience.", "save-failed": "The communication could not be saved.",
};
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });

export default async function CommunicationsPage({ searchParams }: CommunicationsPageProps) {
  await verifyAdmin();
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : "";
  const supabase = await createClient();
  const { data: session } = await supabase.from("sessions").select("id,name").in("status", ["enrolling", "active"]).order("starts_on").limit(1).maybeSingle();
  if (!session) return <main className="app-shell"><section className="panel"><h1>No active session found.</h1><Link href="/admin">Return to admin</Link></section></main>;

  const [{ data: enrollmentData }, { data: campaignData }] = await Promise.all([
    supabase.from("enrollments").select("member_id,weekly_commitment").eq("session_id", session.id).eq("status", "active"),
    supabase.from("communication_campaigns").select("id,kind,audience,subject,status,recipient_count,sent_count,failed_count,sent_at,created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const enrollments = (enrollmentData ?? []) as Enrollment[];
  const memberIds = enrollments.map((row) => row.member_id);
  const { data: contacts } = memberIds.length ? await supabase.from("member_contacts").select("user_id").in("user_id", memberIds).eq("email_opt_in", true) : { data: [] };
  const eligibleIds = new Set((contacts ?? []).map((contact) => contact.user_id));
  const eligible = enrollments.filter((row) => eligibleIds.has(row.member_id));

  return <main className="app-shell admin-shell communications-shell">
    <header className="app-header"><div><span className="eyebrow">Holden Health admin</span><h1>Communications.</h1><p className="lede">Write once, preview it, and keep every member update in the same familiar style.</p></div><Link className="button secondary" href="/admin">← Back to dashboard</Link></header>
    {message ? <p className={`notice ${new Set(["preview-failed", "send-failed", "missing-fields", "invalid-button", "email-not-configured", "confirm-send", "recipient-error", "no-recipients", "save-failed"]).has(message) ? "error" : "success"}`} role="status">{messages[message] ?? message}</p> : null}
    <section className="communication-intro panel"><div><span className="eyebrow">Current audience</span><h2>{session.name}</h2></div><div className="communication-counts"><span><strong>{eligible.length}</strong> active</span><span><strong>{eligible.filter((row) => row.weekly_commitment === 2).length}</strong> two-day</span><span><strong>{eligible.filter((row) => row.weekly_commitment === 3).length}</strong> three-day</span></div></section>
    <CommunicationComposer sessionId={session.id} allCount={eligible.length} twoDayCount={eligible.filter((row) => row.weekly_commitment === 2).length} threeDayCount={eligible.filter((row) => row.weekly_commitment === 3).length} />
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">Communication history</span><h2>What members were sent.</h2></div><p>A permanent record keeps Kelsey from wondering whether an update already went out.</p></div><div className="campaign-history">{((campaignData ?? []) as Campaign[]).length ? ((campaignData ?? []) as Campaign[]).map((campaign) => <article className="panel" key={campaign.id}><div><span className="eyebrow">{campaign.kind.replaceAll("_", " ")}</span><h3>{campaign.subject}</h3><p>{dateFormatter.format(new Date(campaign.sent_at ?? campaign.created_at))} · {campaign.audience.replaceAll("_", " ")}</p></div><div><span className={`status-pill ${campaign.status === "sent" ? "success" : "warning"}`}>{campaign.status}</span><p>{campaign.sent_count} sent{campaign.failed_count ? ` · ${campaign.failed_count} failed` : ""}</p></div></article>) : <section className="panel empty-inline"><h3>No communications sent yet.</h3><p>The first newsletter or member update will appear here.</p></section>}</div></section>
  </main>;
}
