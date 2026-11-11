import Link from "next/link";
import ClassSelector from "./class-selector";
import BrandLogo from "@/components/brand-logo";
import PrivacyNotice from "@/components/privacy-notice";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWebsiteSettings } from "@/lib/website-pages";
import { DROP_IN_PHOTO_RELEASE, DROP_IN_WAIVER } from "@/lib/drop-in-agreement";
import { submitDropInBooking } from "@/app/actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const label = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });

export default async function DropInPage({ searchParams }: Props) {
  const params = await searchParams;
  const db = createAdminClient();
  const { data: settingsRecord } = await db.from("site_content").select("value").eq("content_key", "website:settings").maybeSingle();
  const visible = normalizeWebsiteSettings(settingsRecord?.value).drop_in_visible;
  if (!visible) return <main className="auth-shell"><section className="auth-card"><span className="eyebrow">Drop-in classes</span><h1>Classes are being prepared.</h1><p className="lede">Check back soon for available dates, or contact Kelsey with a question.</p><a className="button primary" href="https://holden.health/contact.html">Contact Kelsey</a></section></main>;

  const { data: meetings, error } = await db.from("class_meetings").select("id,title,starts_at,drop_in_capacity,drop_in_price_cents").eq("drop_in_enabled", true).eq("cancelled", false).gt("starts_at", new Date().toISOString()).order("starts_at").limit(80);
  if (error) throw new Error("Available classes could not be loaded.");
  const ids = (meetings ?? []).map(meeting => meeting.id);
  const { data: bookings } = ids.length ? await db.from("drop_in_bookings").select("meeting_id,status").in("meeting_id", ids).in("status", ["requested", "confirmed"]) : { data: [] };
  const counts = new Map<string, number>();
  for (const booking of bookings ?? []) counts.set(booking.meeting_id, (counts.get(booking.meeting_id) ?? 0) + 1);
  const requested = Array.isArray(params.class) ? params.class : params.class ? [params.class] : [];
  const selected = (meetings ?? []).filter(meeting => requested.includes(meeting.id));
  const available = selected.length > 0 && selected.length === new Set(requested).size && selected.every(meeting => meeting.drop_in_capacity > (counts.get(meeting.id) ?? 0));
  const showDetails = available && (params.step === "details" || (!params.step && requested.length === 1));
  const total = selected.reduce((sum, meeting) => sum + meeting.drop_in_price_cents, 0);
  const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const method = params.payment === "venmo" ? "venmo" : "cash";

  return <main className="auth-shell"><section className="auth-card register-card drop-in-shell">
    <BrandLogo className="wordmark" href="https://holden.health" />
    {params.sent === "1" ? <>
      <span className="eyebrow">Spot reserved</span><h1>You’re signed up.</h1>
      <p className="lede">Your selected class spots are reserved. {method === "venmo" ? "Please send your class payment by Venmo before class." : "Please bring cash to class."} Kelsey will mark your payment received after she gets it.</p>
      {method === "venmo" && <div className="soft-note"><strong>Pay @holdenhealthllc on Venmo</strong><p>Include the name you registered with and your class dates in the payment note.</p><a className="button primary" href="https://venmo.com/u/holdenhealthllc" target="_blank" rel="noopener noreferrer">Open Venmo</a></div>}
      <Link className="button secondary" href="/drop-in">See other classes</Link>
    </> : <>
      <span className="eyebrow">Choose your dates</span><h1>Drop in and get moving.</h1><p className="lede">Choose one or more classes, reserve your spots, and pay by Venmo before class or cash when you arrive. All fitness levels are welcome.</p><p><a href="https://holden.health/coaching.html#location">Class location and directions</a></p>
      {params.message && <p className="notice error" role="alert">{params.message === "class-full" ? "One of your classes just filled up. No new spots were reserved. Please choose your dates again." : params.message === "already-requested" ? "You have already signed up for one of those classes. No new spots were reserved. Choose only dates you have not booked yet, or contact Kelsey." : "We could not save your booking. Please check your details or choose another class."}</p>}
      {params.step === "details" && !available && <p className="notice error" role="alert">Please choose available class dates to continue.</p>}
      {!showDetails && (meetings?.length ? <ClassSelector classes={meetings.map(meeting => ({ id: meeting.id, label: label.format(new Date(meeting.starts_at)), title: meeting.title, price: meeting.drop_in_price_cents, remaining: Math.max(0, meeting.drop_in_capacity - (counts.get(meeting.id) ?? 0)) }))} initialSelection={selected.filter(meeting => meeting.drop_in_capacity > (counts.get(meeting.id) ?? 0)).map(meeting => meeting.id)} /> : <p>No drop-in dates are open yet. Please check back soon.</p>)}
      {showDetails && <section id="booking" className="panel drop-in-booking"><h2>Reserve your classes</h2>
        <ul>{selected.map(meeting => <li key={meeting.id}>{label.format(new Date(meeting.starts_at))} · {money(meeting.drop_in_price_cents)}</li>)}</ul>
        <p><strong>{selected.length} {selected.length === 1 ? "class" : "classes"} · Total {money(total)} per person.</strong> Your spots are reserved when you submit this form.</p>
        <Link className="button secondary" href={`/drop-in?step=choose&${selected.map(meeting => `class=${meeting.id}`).join("&")}`}>Change dates</Link>
        <form className="stack-form" action={submitDropInBooking}>
          {selected.map(meeting => <input key={meeting.id} type="hidden" name="meetingId" value={meeting.id} />)}<label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
          <div className="field-grid"><label>Full name<input name="fullName" autoComplete="name" required /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label></div>
          <label>Phone number<input name="phone" type="tel" autoComplete="tel" required /></label>
          <fieldset><legend>How will you pay?</legend><label className="check-label"><input type="radio" name="paymentMethod" value="venmo" required /> Venmo @holdenhealthllc before class</label><label className="check-label"><input type="radio" name="paymentMethod" value="cash" required /> Cash at class</label></fieldset>
          <section><h3>Drop-in class agreement</h3>{DROP_IN_WAIVER.split("\n\n").map(paragraph => <p key={paragraph}>{paragraph}</p>)}<label className="check-label"><input name="waiverAccepted" type="checkbox" required /> I have read and agree to the drop-in class agreement.</label><label>Type your full name as your signature<input name="signedName" autoComplete="name" required /></label></section>
          <fieldset><legend>Photo and video permission</legend><p>{DROP_IN_PHOTO_RELEASE}</p><label className="check-label"><input type="radio" name="photoConsent" value="yes" required /> Yes, Holden Health may use recognizable photos or videos of me for promotion.</label><label className="check-label"><input type="radio" name="photoConsent" value="no" required /> No, do not use recognizable photos or videos of me for promotion.</label></fieldset>
          <label>Anything Kelsey should know? (optional)<textarea name="note" maxLength={1000} /></label><PrivacyNotice /><button className="button primary" type="submit">Reserve my {selected.length === 1 ? "spot" : "spots"} · {money(total)}</button>
        </form></section>}
    </>}
  </section></main>;
}
