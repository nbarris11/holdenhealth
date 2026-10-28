import { consultationCalendarInvite } from "@/lib/consultation-calendar";
import { NextResponse, type NextRequest } from "next/server";
import { sendTransactionalEmail } from "@/lib/email";
import { captureServerEvent, captureServerException, distinctIdForValue } from "@/lib/posthog-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createScheduledZoomMeeting } from "@/lib/zoom";

const KELSEY_EMAIL = "holdenhealth.coaching@gmail.com";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ORIGINS = new Set([
  "https://holden.health",
  "https://www.holden.health",
  "https://holdenhealth-tau.vercel.app",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function clean(value: FormDataEntryValue | null, maxLength = 3000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function appointmentLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit",
  }).format(new Date(value));
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.has(origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.has(origin)) return NextResponse.json({ ok: false }, { status: 403 });
  const supabase = createAdminClient();
  const { data: slots, error } = await supabase.from("consultation_slots")
    .select("id,starts_at,duration_minutes")
    .eq("active", true)
    .gt("starts_at", new Date().toISOString())
    .lt("starts_at", new Date(Date.now() + 90 * 86400000).toISOString())
    .order("starts_at");
  if (error) return NextResponse.json({ ok: false }, { status: 500, headers: corsHeaders(origin) });
  const { data: booked, error: bookedError } = await supabase.from("consultation_bookings").select("slot_id").eq("status", "booked");
  if (bookedError) return NextResponse.json({ ok: false }, { status: 503, headers: corsHeaders(origin) });
  const bookedIds = (booked ?? []).map((booking) => booking.slot_id);
  const { data: bookedSlots, error: rangeError } = bookedIds.length
    ? await supabase.from("consultation_slots").select("starts_at,duration_minutes").in("id", bookedIds)
    : { data: [], error: null };
  if (rangeError) return NextResponse.json({ ok: false }, { status: 503, headers: corsHeaders(origin) });
  const available = (slots ?? []).filter((slot) => !(bookedSlots ?? []).some((booking) => {
    const start = new Date(slot.starts_at).getTime();
    const bookedStart = new Date(booking.starts_at).getTime();
    return start < bookedStart + booking.duration_minutes * 60000 && bookedStart < start + slot.duration_minutes * 60000;
  }));
  return NextResponse.json({ ok: true, slots: available }, { headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.has(origin)) return NextResponse.json({ ok: false }, { status: 403 });
  const supabase = createAdminClient();
  let bookingId: string | null = null;

  try {
    const formData = await request.formData();
    if (clean(formData.get("bot-field"), 200)) return NextResponse.json({ ok: true }, { headers: corsHeaders(origin) });
    const slotId = clean(formData.get("slotId"), 40);
    const fullName = clean(formData.get("name"), 140);
    const email = clean(formData.get("email"), 254).toLowerCase();
    const phone = clean(formData.get("phone"), 40);
    if (!UUID_PATTERN.test(slotId) || fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, message: "Check your booking details." }, { status: 400, headers: corsHeaders(origin) });
    }

    const { data: slot } = await supabase.from("consultation_slots").select("id,starts_at,duration_minutes,active").eq("id", slotId).eq("active", true).gt("starts_at", new Date().toISOString()).maybeSingle();
    if (!slot) return NextResponse.json({ ok: false, message: "That time is no longer available." }, { status: 409, headers: corsHeaders(origin) });

    const { data: booking, error: bookingError } = await supabase.from("consultation_bookings").insert({
      slot_id: slot.id,
      full_name: fullName,
      email,
      phone: phone || null,
      goal: clean(formData.get("goal"), 200) || null,
      note: clean(formData.get("note")) || null,
    }).select("id").single();
    if (bookingError || !booking) {
      const unavailable = bookingError?.code === "23505";
      return NextResponse.json({ ok: false, message: unavailable ? "Someone just booked that time. Please choose another." : "The appointment could not be saved." }, { status: unavailable ? 409 : 500, headers: corsHeaders(origin) });
    }
    bookingId = booking.id;

    const zoom = await createScheduledZoomMeeting(`Free consultation with ${fullName}`, slot.starts_at, slot.duration_minutes);
    const zoomJoinUrl = zoom.joinUrl;
    const { error: zoomSaveError } = await supabase.from("consultation_bookings").update({ zoom_meeting_id: zoom.zoomMeetingId, zoom_join_url: zoom.joinUrl }).eq("id", booking.id);
    if (zoomSaveError) throw zoomSaveError;

    const when = appointmentLabel(slot.starts_at);
    const calendarInvite = consultationCalendarInvite(booking.id, fullName, slot.starts_at, slot.duration_minutes, zoomJoinUrl);
    const visitorBody = `Your free 30–60 minute Zoom conversation with Kelsey is booked for ${when}. Use the private Zoom button below when it is time to join. Kelsey received the same appointment details.\n\nIf you need to adjust your appointment time, please email Kelsey at ${KELSEY_EMAIL} and let her know as soon as possible.\n\nAn Add to Calendar invitation is attached with the meeting time and Zoom link. Please keep your link private.`;
    await Promise.all([
      sendTransactionalEmail(email, "Your free call with Kelsey is booked", {
        firstName: fullName.split(/\s+/)[0] || "there",
        preheader: `Your Holden Health conversation is booked for ${when}.`,
        heading: "You’re on Kelsey’s calendar.",
        body: visitorBody,
        ctaLabel: zoomJoinUrl ? "Join Zoom call" : undefined,
        ctaUrl: zoomJoinUrl,
      }, { idempotencyKey: `consultation-visitor-${booking.id}`, attachments: [calendarInvite] }),
      sendTransactionalEmail(KELSEY_EMAIL, `Free call booked with ${fullName}`, {
        firstName: "Kelsey",
        preheader: `${fullName} booked a Zoom consultation.`,
        heading: "A free consultation was booked.",
        body: `${fullName} booked a Zoom consultation for ${when}. The calendar invitation is attached.\n\nEmail: ${email}\nPhone: ${phone || "Not provided"}\nInterested in: ${clean(formData.get("goal"), 200) || "Not specified"}\nNote: ${clean(formData.get("note")) || "No note included."}`,
        ctaLabel: zoomJoinUrl ? "Join Zoom call" : undefined,
        ctaUrl: zoomJoinUrl,
      }, { idempotencyKey: `consultation-kelsey-${booking.id}`, replyTo: email, attachments: [calendarInvite] }),
    ]);

    const distinctId = distinctIdForValue(email);
    await captureServerEvent(distinctId, "consultation_booked", {
      duration_minutes: slot.duration_minutes,
      format: "zoom",
    });
    return NextResponse.json({ ok: true, startsAt: slot.starts_at, format: "zoom" }, { headers: corsHeaders(origin) });
  } catch (error) {
    await captureServerException(error, bookingId ?? "consultation_booking");
    if (bookingId) await supabase.from("consultation_bookings").delete().eq("id", bookingId);
    return NextResponse.json({ ok: false, message: "The appointment could not be completed. Please try again." }, { status: 500, headers: corsHeaders(origin) });
  }
}
