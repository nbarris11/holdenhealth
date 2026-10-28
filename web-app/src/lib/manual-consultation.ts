import type { SupabaseClient } from "@supabase/supabase-js";
import { consultationCalendarInvite } from "@/lib/consultation-calendar";
import { sendTransactionalEmail } from "@/lib/email";

export const COACH_EMAIL = "holdenhealth.coaching@gmail.com";

// Round-trip the entered wall time so impossible dates and spring DST gaps
// cannot silently turn into a different appointment time.
export function manualConsultationTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const wall = new Date(`${date}T${time}:00Z`);
  if (!Number.isFinite(wall.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = (value: Date) => Object.fromEntries(formatter.formatToParts(value).map(p => [p.type, p.value]));
  let result = wall;
  for (let i = 0; i < 3; i++) {
    const p = parts(result);
    const represented = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
    result = new Date(result.getTime() + wall.getTime() - represented);
  }
  const p = parts(result);
  return `${p.year}-${p.month}-${p.day}` === date && `${p.hour}:${p.minute}` === time ? result : null;
}

export type InviteBooking = {
  id: string; full_name: string; email: string; zoom_join_url: string;
  visitor_invite_sent_at: string | null; coach_invite_sent_at: string | null;
};

export async function sendManualConsultationInvites(
  supabase: SupabaseClient, booking: InviteBooking,
  slot: { starts_at: string; duration_minutes: number },
) {
  const when = new Intl.DateTimeFormat("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric",
    minute: "2-digit", timeZone: "America/Detroit", timeZoneName: "short",
  }).format(new Date(slot.starts_at));
  const attachment = consultationCalendarInvite(booking.id, booking.full_name, slot.starts_at, slot.duration_minutes, booking.zoom_join_url);
  const recipients = [
    { field: "visitor_invite_sent_at" as const, to: booking.email, firstName: booking.full_name.split(/\s+/)[0],
      subject: "Your Zoom call with Kelsey is booked", heading: "You’re on Kelsey’s calendar.",
      body: `Kelsey scheduled your Zoom call for ${when}. Your appointment reserves ${slot.duration_minutes} minutes.\n\nUse the private Zoom link below to join. An Add to Calendar invitation is attached with the time and link.\n\nIf you need a different time, reply to this email to reach Kelsey.`, replyTo: COACH_EMAIL },
    { field: "coach_invite_sent_at" as const, to: COACH_EMAIL, firstName: "Kelsey",
      subject: `Zoom call with ${booking.full_name}`, heading: "Your Zoom call is scheduled.",
      body: `Your Zoom call with ${booking.full_name} is scheduled for ${when}, for ${slot.duration_minutes} minutes.\n\nEmail: ${booking.email}\n\nThe calendar invitation is attached. Use the same private Zoom link below to join.`, replyTo: booking.email },
  ];
  const results = await Promise.allSettled(recipients.map(async recipient => {
    if (booking[recipient.field]) return true;
    const sent = await sendTransactionalEmail(recipient.to, recipient.subject, {
      firstName: recipient.firstName, preheader: `Zoom call: ${when}`, heading: recipient.heading,
      body: recipient.body, ctaLabel: "Join Zoom call", ctaUrl: booking.zoom_join_url,
    }, { idempotencyKey: `manual-consultation-${recipient.field}-${booking.id}`, replyTo: recipient.replyTo, attachments: [attachment] });
    if (!sent) return false;
    const { error, data } = await supabase.from("consultation_bookings")
      .update({ [recipient.field]: new Date().toISOString() }).eq("id", booking.id).select("id").single();
    return !error && Boolean(data);
  }));
  return results.every(result => result.status === "fulfilled" && result.value);
}
