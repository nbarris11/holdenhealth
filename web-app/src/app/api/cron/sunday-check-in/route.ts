import { SIX_WEEK_CHECK_IN_URL } from "@/lib/check-in";
import { sendTransactionalEmails } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EnrollmentRow = {
  member_id: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

type ContactRow = {
  user_id: string;
  email: string;
  unsubscribe_token: string;
};

function detroitDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function previousDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const dryRun = requestUrl.searchParams.get("dryRun") === "1";
  const simulatedDate = dryRun ? requestUrl.searchParams.get("date") : null;
  const today = simulatedDate && /^\d{4}-\d{2}-\d{2}$/.test(simulatedDate) ? simulatedDate : detroitDate(new Date());
  const supabase = createAdminClient();
  const { data: sessions, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .lte("starts_on", today)
    .gte("ends_on", previousDate(today));

  if (sessionError) return Response.json({ error: "Could not load active sessions" }, { status: 500 });
  const sessionIds = (sessions ?? []).map((session) => session.id);
  if (!sessionIds.length) return Response.json({ ok: true, sent: 0, reason: "No active six-week session" });

  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("member_id,profiles(full_name)")
    .in("session_id", sessionIds)
    .eq("status", "active");

  if (enrollmentError) return Response.json({ error: "Could not load active members" }, { status: 500 });
  const enrollments = [...new Map(((enrollmentData ?? []) as unknown as EnrollmentRow[]).map((enrollment) => [enrollment.member_id, enrollment])).values()];
  const memberIds = [...new Set(enrollments.map((enrollment) => enrollment.member_id))];
  if (!memberIds.length) return Response.json({ ok: true, sent: 0, reason: "No active members" });

  const { data: contactData, error: contactError } = await supabase
    .from("member_contacts")
    .select("user_id,email,unsubscribe_token")
    .in("user_id", memberIds)
    .eq("email_opt_in", true)
    .eq("is_test", false);

  if (contactError) return Response.json({ error: "Could not load member contacts" }, { status: 500 });
  const contacts = new Map(((contactData ?? []) as ContactRow[]).map((contact) => [contact.user_id, contact]));
  const messages = enrollments.flatMap((enrollment) => {
    const contact = contacts.get(enrollment.member_id);
    if (!contact) return [];
    const profile = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
    return [{
      to: contact.email,
      subject: "Your Sunday check-in",
      content: {
        firstName: profile?.full_name?.trim().split(/\s+/)[0] || "there",
        preheader: "A few honest minutes can make next week feel more doable.",
        heading: "How did this week really go?",
        body: "Before the new week begins, take a moment to notice what worked. Small wins count, especially the ones that were not part of a perfect plan.\n\nUse your Goal-to-Action sheet as a guide, then complete this week’s check-in. Your answers help me understand what felt manageable, what got in the way, and how I can support you next week.",
        ctaLabel: "Complete my weekly check-in",
        ctaUrl: SIX_WEEK_CHECK_IN_URL,
        unsubscribeToken: contact.unsubscribe_token,
      },
    }];
  });

  if (!messages.length) return Response.json({ ok: true, sent: 0, reason: "No opted-in members" });
  if (dryRun) return Response.json({ ok: true, dryRun: true, eligible: messages.length, date: today });
  const sent = await sendTransactionalEmails(messages, `six-week-sunday-check-in-${today}`);
  if (!sent) return Response.json({ error: "The email provider rejected the reminder batch" }, { status: 502 });

  return Response.json({ ok: true, sent: messages.length, date: today });
}
