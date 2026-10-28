import { loadChallengeRecipients } from "@/lib/challenge-email-recipients";
import Link from "next/link";
import CommunicationComposer from "./composer";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type CommunicationsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Campaign = { id: string; kind: string; audience: string; subject: string; status: string; recipient_count: number; sent_count: number; failed_count: number; sent_at: string | null; created_at: string };
type Delivery = { campaign_id: string; delivered_at: string | null; first_opened_at: string | null; first_clicked_at: string | null };
type Enrollment = { member_id: string; weekly_commitment: number | null };
type WednesdaySubscriber = { id: string; email: string; source: string | null; subscribed_at: string };

const messages: Record<string, string> = {
  "preview-sent": "Preview sent to your admin email.", "preview-failed": "The preview could not be sent.", sent: "Communication sent to the selected audience.",
  "send-failed": "The email provider could not send this communication.", "missing-fields": "Complete the subject, heading, and message.",
  "invalid-button": "Add both button text and a complete button link, or leave both blank.", "email-not-configured": "Email delivery is not configured.",
  "confirm-send": "Check the confirmation box before sending.", "recipient-error": "The recipient list could not be loaded.",
  "no-recipients": "There are no opted-in people in that audience.", "save-failed": "The communication could not be saved.",
};
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });

export default async function CommunicationsPage({ searchParams }: CommunicationsPageProps) {
  await verifyAdmin();
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : "";
  const defaultAudience = params.audience === "free_challenge" ? "free_challenge" : params.audience === "wednesday_note" ? "wednesday_note" : "all_active";
  const supabase = await createClient();
  const { data: session } = await supabase.from("sessions").select("id,name").in("status", ["enrolling", "active"]).order("starts_on").limit(1).maybeSingle();


  const [{ data: enrollmentData }, { data: campaignData }, { data: deliveryData }, { data: subscriberData }, challengeRecipients] = await Promise.all([
    session ? supabase.from("enrollments").select("member_id,weekly_commitment").eq("session_id", session.id).eq("status", "active") : Promise.resolve({ data: [] }),
    supabase.from("communication_campaigns").select("id,kind,audience,subject,status,recipient_count,sent_count,failed_count,sent_at,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("communication_deliveries").select("campaign_id,delivered_at,first_opened_at,first_clicked_at"),
    supabase.from("wednesday_note_subscribers").select("id,email,source,subscribed_at").eq("email_opt_in", true).order("subscribed_at", { ascending: false }),
    loadChallengeRecipients(supabase),
  ]);
  const enrollments = (enrollmentData ?? []) as Enrollment[];
  const memberIds = enrollments.map((row) => row.member_id);
  const { data: contacts } = memberIds.length ? await supabase.from("member_contacts").select("user_id").in("user_id", memberIds).eq("email_opt_in", true).eq("is_test", false) : { data: [] };
  const eligibleIds = new Set((contacts ?? []).map((contact) => contact.user_id));
  const eligible = enrollments.filter((row) => eligibleIds.has(row.member_id));
  const subscribers = (subscriberData ?? []) as WednesdaySubscriber[];
  const engagementByCampaign = ((deliveryData ?? []) as Delivery[]).reduce((summary, delivery) => {
    const current = summary.get(delivery.campaign_id) ?? { delivered: 0, opened: 0, clicked: 0 };
    if (delivery.delivered_at) current.delivered += 1;
    if (delivery.first_opened_at) current.opened += 1;
    if (delivery.first_clicked_at) current.clicked += 1;
    summary.set(delivery.campaign_id, current);
    return summary;
  }, new Map<string, { delivered: number; opened: number; clicked: number }>());

  return <main className="app-shell admin-shell communications-shell">
    <header className="workspace-page-header"><div><span className="eyebrow">Stay connected</span><h1>Messages</h1><p>Email class members, free challenge participants, or Wednesday Note readers.</p></div></header>
    {message ? <p className={`notice ${new Set(["preview-failed", "send-failed", "missing-fields", "invalid-button", "email-not-configured", "confirm-send", "recipient-error", "no-recipients", "save-failed"]).has(message) ? "error" : "success"}`} role="status">{messages[message] ?? message}</p> : null}
    <section className="message-delivery-choice"><div className="panel selected"><span className="choice-mark">✓</span><span className="eyebrow">Email inbox</span><h2>Send an email</h2><p>Best for reminders and anything members should notice soon.</p></div><Link className="panel" href="/admin/content#announcements"><span className="choice-mark">→</span><span className="eyebrow">Member portal</span><h2>Post an announcement</h2><p>Best for information that should stay visible after sign-in.</p></Link></section>
    <section className="panel"><h2>Finished a program?</h2><p>An honest Google review request sends automatically the morning after a program ends. Preview recipients or check previous requests.</p><Link className="button secondary" href="/admin/communications/reviews">Request Google reviews</Link></section>
    <section className="communication-intro panel"><div><span className="eyebrow">Current audiences</span><h2>{session?.name ?? "Email audiences"}</h2><p>The form below sends email only. You can preview it privately before anyone receives it.</p></div><div className="communication-counts"><span><strong>{eligible.length}</strong> class members</span><span><strong>{eligible.filter((row) => row.weekly_commitment === 2).length}</strong> 2-class plan</span><span><strong>{eligible.filter((row) => row.weekly_commitment === 3).length}</strong> 3-class plan</span><span><strong>{challengeRecipients.length}</strong> free challenge</span><span><strong>{subscribers.length}</strong> Wednesday Note</span></div></section>
    <section className="wednesday-subscriber-panel panel"><div className="wednesday-subscriber-heading"><div><span className="eyebrow">The Wednesday Note</span><h2>Subscriber list</h2><p>{subscribers.length} {subscribers.length === 1 ? "person is" : "people are"} currently signed up.</p></div><Link className="button primary" href="/admin/communications?audience=wednesday_note#composer">Email this list</Link></div>{subscribers.length ? <div className="wednesday-subscriber-list">{subscribers.map((subscriber) => <div key={subscriber.id}><a href={`mailto:${subscriber.email}`}>{subscriber.email}</a><span>{subscriber.source || "Holden Health website"}</span><time dateTime={subscriber.subscribed_at}>{dateFormatter.format(new Date(subscriber.subscribed_at))}</time></div>)}</div> : <div className="empty-inline"><p>New signups will appear here automatically.</p></div>}</section>
    <section className="panel"><div className="wednesday-subscriber-heading"><div><span className="eyebrow">Free challenge</span><h2>Challenge participants</h2><p>All free challenge signups with email updates enabled. No paid membership or Wednesday Note subscription needed. Each person receives one email.</p></div><Link className="button primary" href="/admin/communications?audience=free_challenge#composer">Email challenge participants</Link></div><details><summary>{challengeRecipients.length} eligible recipients · View names and emails</summary><div className="wednesday-subscriber-list">{challengeRecipients.map(person => <div key={person.memberId}><Link href={`/admin/people/${person.memberId}`}>{person.name}</Link><span style={{ overflowWrap: "anywhere" }}>{person.email}</span></div>)}</div>{!challengeRecipients.length ? <p>No eligible challenge participants yet.</p> : null}</details></section>
    <CommunicationComposer sessionId={session?.id ?? ""} challengeCount={challengeRecipients.length} allCount={eligible.length} twoDayCount={eligible.filter((row) => row.weekly_commitment === 2).length} threeDayCount={eligible.filter((row) => row.weekly_commitment === 3).length} wednesdayNoteCount={subscribers.length} defaultAudience={!session && defaultAudience === "all_active" ? "free_challenge" : defaultAudience} />
    <section className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Past messages</span><h2>What people received</h2></div><p>Delivery and clicks help confirm an important message reached people.</p></div><div className="campaign-history">{((campaignData ?? []) as Campaign[]).length ? ((campaignData ?? []) as Campaign[]).map((campaign) => {
      const engagement = engagementByCampaign.get(campaign.id) ?? { delivered: 0, opened: 0, clicked: 0 };
      const rateBase = engagement.delivered || campaign.sent_count;
      return <article className="panel" key={campaign.id}><div><span className="eyebrow">{campaign.kind.replaceAll("_", " ")}</span><h3>{campaign.subject}</h3><p>{dateFormatter.format(new Date(campaign.sent_at ?? campaign.created_at))} · {campaign.audience.replaceAll("_", " ")}</p></div><div className="campaign-results"><span className={`status-pill ${campaign.status === "sent" ? "success" : "warning"}`}>{campaign.status}</span><div className="engagement-stats"><span><strong>{engagement.delivered}</strong> delivered</span><span><strong>{engagement.opened}</strong> opened <small>{rateBase ? `${Math.round((engagement.opened / rateBase) * 100)}%` : "N/A"}</small></span><span><strong>{engagement.clicked}</strong> clicked <small>{rateBase ? `${Math.round((engagement.clicked / rateBase) * 100)}%` : "N/A"}</small></span></div>{campaign.failed_count ? <p>{campaign.failed_count} failed</p> : null}</div></article>;
    }) : <section className="panel empty-inline"><h3>No communications sent yet.</h3><p>The first newsletter or member update will appear here.</p></section>}</div></section>
  </main>;
}
