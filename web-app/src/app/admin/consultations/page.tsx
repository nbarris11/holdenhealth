import { randomUUID } from "node:crypto";
import { createManualConsultation, retryManualConsultationInvites } from "./manual-actions";
import InviteSubmit from "./invite-submit";
import { cancelConsultationBooking, closeConsultationSlot, createConsultationSlot, updateConsultationSlot } from "@/app/actions";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Slot = { id: string; starts_at: string; duration_minutes: number; active: boolean };
type Booking = { id: string; slot_id: string; full_name: string; email: string; phone: string | null; goal: string | null; note: string | null; status: string; zoom_join_url: string | null; manually_created: boolean; visitor_invite_sent_at: string | null; coach_invite_sent_at: string | null };

const messages: Record<string, { tone: "success" | "error"; text: string }> = {
  "invite-sent": { tone: "success", text: "Zoom invites were sent to your guest and holdenhealth.coaching@gmail.com. Both emails include the Zoom link and calendar attachment." },
  "invite-details-invalid": { tone: "error", text: "Enter a name and valid email address, then try again." },
  "invite-conflict": { tone: "error", text: "That appointment was already submitted or overlaps a booked call. Check your schedule before choosing another time." },
  "invite-create-failed": { tone: "error", text: "The appointment could not be saved. Check your details and try again." },
  "invite-zoom-failed": { tone: "error", text: "The time is reserved, but Zoom setup could not be confirmed. No invites were sent. Cancel this appointment before creating a new one." },
  "invite-email-failed": { tone: "error", text: "Your Zoom call is saved, but one or both invites could not be confirmed as sent. Use Retry unsent invites on the appointment below." },
  "slot-reopened": { tone: "success", text: "That closed time is open again on the public booking calendar." },
  "slot-created": { tone: "success", text: "Zoom consultation time added." },
  "series-created": { tone: "success", text: "Your 60-minute appointment windows were published." },
  "slot-updated": { tone: "success", text: "The open Zoom time was updated." },
  "slot-closed": { tone: "success", text: "That Zoom time is no longer public." },
  "booking-cancelled": { tone: "success", text: "The appointment was cancelled and the visitor was emailed." },
  "time-in-past": { tone: "error", text: "Choose a future date and time." },
  "time-exists": { tone: "error", text: "That time is already open on the calendar. No duplicate was added." },
  "repeat-end-required": { tone: "error", text: "Choose an end date for the recurring times." },
  "repeat-days-required": { tone: "error", text: "Choose at least one weekday for recurring availability." },
  "repeat-end-before-start": { tone: "error", text: "The repeat end date must be after the first appointment." },
  "time-window-invalid": { tone: "error", text: "The daily availability window must be at least 60 minutes long." },
  "time-increment-invalid": { tone: "error", text: "Choose a time at the top or half of the hour, such as 2:00 or 2:30." },
  "too-many-slots": { tone: "error", text: "That schedule creates too many times at once. Shorten the date range and publish it in two batches." },
  "no-matching-days": { tone: "error", text: "No selected weekdays fall inside that date range." },
  "slot-create-failed": { tone: "error", text: "The Zoom time could not be added." },
  "slot-update-failed": { tone: "error", text: "The Zoom time could not be updated." },
  "slot-close-failed": { tone: "error", text: "That time could not be closed." },
  "slot-booked": { tone: "error", text: "That time overlaps a booked call. Choose another time, or cancel the appointment first if needed." },
  "booking-cancel-failed": { tone: "error", text: "The appointment could not be cancelled." },
};

const dateTimeLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit",
});
const dateLabel = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "America/Detroit",
});
const visibleOpenSlotCount = 7;

function detroitParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function BookedCall({ slot, booking }: { slot: Slot; booking: Booking }) {
  return <article className="panel consultation-slot booked">
    <div><span className="status-pill success">{booking.zoom_join_url ? "Zoom booked" : "Zoom setup incomplete"}</span><h3>{dateTimeLabel.format(new Date(slot.starts_at))}</h3><p>{slot.duration_minutes} minutes · Eastern time</p>{booking.manually_created ? <p>{booking.visitor_invite_sent_at ? "Guest invite sent" : "Guest invite pending"} · {booking.coach_invite_sent_at ? "Your invite sent" : "Your invite pending"}</p> : null}</div>
    <div className="consultation-person"><strong>{booking.full_name}</strong><a href={`mailto:${booking.email}`}>{booking.email}</a>{booking.phone ? <a href={`tel:${booking.phone}`}>{booking.phone}</a> : null}{booking.goal ? <span>Interested in: {booking.goal}</span> : null}{booking.note ? <span>{booking.note}</span> : null}<div className="button-row">{booking.zoom_join_url ? <a className="button primary" href={booking.zoom_join_url} target="_blank" rel="noreferrer">Join Zoom ↗</a> : null}{booking.manually_created && booking.zoom_join_url && (!booking.visitor_invite_sent_at || !booking.coach_invite_sent_at) ? <form action={retryManualConsultationInvites}><input type="hidden" name="bookingId" value={booking.id} /><InviteSubmit retry /></form> : null}<form action={cancelConsultationBooking}><input type="hidden" name="bookingId" value={booking.id} /><button className="button secondary" type="submit">Cancel appointment</button></form></div></div>
  </article>;
}

function OpenTime({ slot }: { slot: Slot }) {
  return <details className="panel consultation-open-slot">
    <summary>
      <span><strong>{dateTimeLabel.format(new Date(slot.starts_at))}</strong><small>{slot.duration_minutes} minutes</small></span>
      <span className="consultation-open-action"><span className="status-pill neutral">Open</span><b>Edit</b><span aria-hidden="true">⌄</span></span>
    </summary>
    <div className="consultation-slot-controls">
      <form className="slot-edit-form" action={updateConsultationSlot}><input type="hidden" name="slotId" value={slot.id} /><label>Date<input name="date" type="date" defaultValue={detroitParts(slot.starts_at).date} required /></label><label>Time<input name="time" type="time" step="1800" defaultValue={detroitParts(slot.starts_at).time} required /></label><button className="button primary" type="submit">Update time</button></form>
      <form action={closeConsultationSlot}><input type="hidden" name="slotId" value={slot.id} /><button className="button secondary" type="submit">Remove open time</button></form>
    </div>
  </details>;
}

export default async function ConsultationsPage({ searchParams }: PageProps) {
  await verifyAdmin();
  const params = await searchParams;
  const message = messages[typeof params.message === "string" ? params.message : ""];
  const supabase = await createClient();
  const [{ data: slotData }, { data: bookingData }] = await Promise.all([
    supabase.from("consultation_slots").select("id,starts_at,duration_minutes,active").gt("starts_at", new Date().toISOString()).order("starts_at"),
    supabase.from("consultation_bookings").select("id,slot_id,full_name,email,phone,goal,note,status,zoom_join_url,manually_created,visitor_invite_sent_at,coach_invite_sent_at").eq("status", "booked").order("created_at"),
  ]);
  const slots = (slotData ?? []) as Slot[];
  const bookings = (bookingData ?? []) as Booking[];
  const bookingMap = new Map(bookings.map((booking) => [booking.slot_id, booking]));
  const bookedCalls = slots.flatMap((slot) => {
    const booking = bookingMap.get(slot.id);
    return booking ? [{ slot, booking }] : [];
  });
  const openTimes = slots.filter((slot) => slot.active && !bookingMap.has(slot.id));
  const firstOpenTimes = openTimes.slice(0, visibleOpenSlotCount);
  const laterOpenTimes = openTimes.slice(visibleOpenSlotCount);
  const finalOpenTime = openTimes.at(-1);
  const today = detroitParts(new Date().toISOString()).date;
  const defaultPublishThrough = addDays(today, 56);

  return <main className="app-shell admin-shell workspace-page consultation-page">
    <header className="workspace-page-header"><div><span className="eyebrow">Free intro calls</span><h1>Zoom calls</h1><p>Send an invite directly or publish times for people to book. All times are Eastern (Detroit).</p></div><a className="button secondary" href="https://holden.health/book.html" target="_blank" rel="noreferrer">View booking page ↗</a></header>
    {message ? <p className={`notice ${message.tone}`} role="status">{message.text}</p> : null}

    <section className="panel" aria-labelledby="manual-invite-heading">
      <span className="eyebrow">Book someone directly</span>
      <h2 id="manual-invite-heading">Send a Zoom invite</h2>
      <p>Heard from someone on Instagram, by text, or in person? Enter their details and the time you agreed on. They don’t need an account or the signup form.</p>
      <form className="stack-form" action={createManualConsultation}>
        <input type="hidden" name="bookingId" value={randomUUID()} />
        <div className="field-grid">
          <label>Name<input name="fullName" autoComplete="name" minLength={2} maxLength={140} required /></label>
          <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
          <label>Date<input name="date" type="date" min={today} required /></label>
          <label>Time (Eastern)<input name="time" type="time" required /></label>
        </div>
        <p>Reserves 60 minutes. Both your guest and you ({"holdenhealth.coaching@gmail.com"}) receive an email with the Zoom link and an Add to Calendar attachment.</p>
        <div><InviteSubmit /></div>
      </form>
    </section>

    <section className="consultation-layout">
      <section className="panel consultation-availability-builder simplified">
        <div className="consultation-builder-heading"><span><span className="eyebrow">Availability</span><strong>Set your weekly schedule</strong><small>Choose your working window once. Consultations last 30–60 minutes. Each booking reserves a full hour.</small></span><span className="status-pill success">60-minute windows</span></div>
        <form className="stack-form" action={createConsultationSlot}>
          <input name="availabilityMode" type="hidden" value="weekly-window" />
          <div className="availability-form-section"><div><strong>1. Choose the date range</strong><small>Eight weeks is filled in to make this quick.</small></div><div className="field-grid"><label>Starts on<input name="date" type="date" defaultValue={today} required /></label><label>Publish through<input name="repeatUntil" type="date" defaultValue={defaultPublishThrough} required /></label></div></div>
          <div className="availability-form-section"><div><strong>2. Choose the weekdays</strong><small>Tuesday through Friday are selected based on your current schedule.</small></div><fieldset className="weekday-picker"><legend className="sr-only">Days for recurring availability</legend>{[[1,"Mon"],[2,"Tue"],[3,"Wed"],[4,"Thu"],[5,"Fri"],[6,"Sat"],[0,"Sun"]].map(([value, label]) => <label key={value}><input name="repeatDays" type="checkbox" value={value} defaultChecked={[2,3,4,5].includes(Number(value))} /><span>{label}</span></label>)}</fieldset></div>
          <div className="availability-form-section"><div><strong>3. Choose the daily time window</strong><small>Example: 5:00 PM–8:00 PM creates 5:00, 6:00, and 7:00 PM appointments.</small></div><div className="field-grid"><label>Available from<input name="startTime" type="time" step="1800" required /></label><label>Available until<input name="endTime" type="time" step="1800" required /></label></div></div>
          <button className="button primary" type="submit">Publish call times</button>
        </form>
        <details className="single-slot-disclosure"><summary>Add one extra time instead <span aria-hidden="true">⌄</span></summary><form className="slot-edit-form" action={createConsultationSlot}><input name="availabilityMode" type="hidden" value="single" /><label>Date<input name="date" type="date" min={today} required /></label><label>Time (Eastern)<input name="time" type="time" required /></label><button className="button secondary" type="submit">Add extra time</button></form></details>
      </section>
      <aside className="panel consultation-explainer"><span className="eyebrow">How it works</span><h2>Automatic after booking.</h2><ol><li>They choose Zoom on the free-call page.</li><li>They pick one of your open times.</li><li>Zoom creates a private appointment.</li><li>The same link goes to both of you.</li></ol></aside>
    </section>

    <section className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Upcoming</span><h2>Your Zoom schedule</h2></div><p>Booked calls stay prominent. Open availability remains easy to review without taking over the page.</p></div>
      <div className="panel consultation-schedule-summary">
        <div><strong>{bookedCalls.length}</strong><span>booked call{bookedCalls.length === 1 ? "" : "s"}</span></div>
        <div><strong>{openTimes.length}</strong><span>open time{openTimes.length === 1 ? "" : "s"}</span></div>
        <div><strong>{finalOpenTime ? dateLabel.format(new Date(finalOpenTime.starts_at)) : "—"}</strong><span>published through</span></div>
      </div>

      <div id="appointments" className="consultation-schedule-group"><div className="consultation-group-heading"><div><span className="eyebrow">Appointments</span><h3>Next booked calls</h3></div><span className={`status-pill ${bookedCalls.length ? "success" : "neutral"}`}>{bookedCalls.length ? `${bookedCalls.length} scheduled` : "None scheduled"}</span></div>
        <div className="consultation-slot-list">{bookedCalls.length ? bookedCalls.map(({ slot, booking }) => <BookedCall slot={slot} booking={booking} key={slot.id} />) : <div className="panel calm-empty compact"><span className="calm-check">✓</span><div><h3>No Zoom calls booked</h3><p>New appointments will appear here as soon as someone chooses an open time.</p></div></div>}</div>
      </div>

      <div className="consultation-schedule-group"><div className="consultation-group-heading"><div><span className="eyebrow">Availability</span><h3>Open times</h3></div>{openTimes.length ? <span>{openTimes.length > visibleOpenSlotCount ? `Next ${visibleOpenSlotCount} shown` : "All times shown"}</span> : null}</div>
        {openTimes.length ? <div className="consultation-open-list">{firstOpenTimes.map((slot) => <OpenTime slot={slot} key={slot.id} />)}{laterOpenTimes.length ? <details className="consultation-later-slots"><summary>Show {laterOpenTimes.length} later open time{laterOpenTimes.length === 1 ? "" : "s"}<span aria-hidden="true">⌄</span></summary><div>{laterOpenTimes.map((slot) => <OpenTime slot={slot} key={slot.id} />)}</div></details> : null}</div> : <div className="panel calm-empty compact"><div><h3>No open Zoom times</h3><p>Add availability when Kelsey’s calendar is ready.</p></div></div>}
      </div>
    </section>
  </main>;
}
