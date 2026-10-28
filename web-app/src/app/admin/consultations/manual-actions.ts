"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createScheduledZoomMeeting } from "@/lib/zoom";
import { manualConsultationTime, sendManualConsultationInvites } from "@/lib/manual-consultation";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function finish(message: string): never {
  revalidatePath("/admin/consultations");
  redirect(`/admin/consultations?message=${message}`);
}

export async function createManualConsultation(form: FormData) {
  await verifyAdmin();
  const bookingId = String(form.get("bookingId") ?? "");
  const fullName = String(form.get("fullName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const startsAt = manualConsultationTime(String(form.get("date") ?? ""), String(form.get("time") ?? ""));
  if (!uuid.test(bookingId) || fullName.length < 2 || fullName.length > 140 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) finish("invite-details-invalid");
  if (!startsAt || startsAt <= new Date()) finish("time-in-past");
  const supabase = await createClient();
  const { error } = await supabase.rpc("book_manual_consultation", {
    p_booking_id: bookingId, p_starts_at: startsAt.toISOString(), p_full_name: fullName, p_email: email,
  });
  if (error) finish(error.code === "23505" ? "invite-conflict" : "invite-create-failed");

  // Keep the reserved appointment if Zoom or email fails. This prevents an
  // accidental second booking after an external service has accepted a request.
  let ready = false;
  try {
    const { data: booking } = await supabase.from("consultation_bookings").select("slot_id").eq("id", bookingId).single();
    const { data: slot } = await supabase.from("consultation_slots").select("starts_at,duration_minutes").eq("id", booking?.slot_id).single();
    if (slot) {
      const zoom = await createScheduledZoomMeeting(`Free consultation with ${fullName}`, slot.starts_at, slot.duration_minutes);
      const saved = await supabase.from("consultation_bookings").update({ zoom_meeting_id: zoom.zoomMeetingId, zoom_join_url: zoom.joinUrl })
        .eq("id", bookingId).eq("status", "booked").select("id").single();
      ready = !saved.error && Boolean(saved.data);
    }
  } catch { /* The schedule exposes the incomplete appointment for recovery. */ }
  if (!ready) finish("invite-zoom-failed");
  await retryManualConsultationInvites(form);
}

export async function retryManualConsultationInvites(form: FormData) {
  await verifyAdmin();
  const bookingId = String(form.get("bookingId") ?? "");
  if (!uuid.test(bookingId)) finish("invite-details-invalid");
  const supabase = await createClient();
  const { data: booking } = await supabase.from("consultation_bookings")
    .select("id,slot_id,full_name,email,zoom_join_url,visitor_invite_sent_at,coach_invite_sent_at")
    .eq("id", bookingId).eq("status", "booked").eq("manually_created", true).single();
  if (!booking?.zoom_join_url) finish("invite-zoom-failed");
  const { data: slot } = await supabase.from("consultation_slots").select("starts_at,duration_minutes").eq("id", booking.slot_id).single();
  if (!slot || new Date(slot.starts_at) <= new Date()) finish("time-in-past");
  const sent = await sendManualConsultationInvites(supabase, booking, slot);
  finish(sent ? "invite-sent" : "invite-email-failed");
}
