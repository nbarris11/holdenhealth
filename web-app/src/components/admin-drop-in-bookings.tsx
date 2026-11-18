import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });

// Read existing bookings directly so earlier reservations appear here too.
export async function AdminDropInBookings() {
  const db = await createClient();
  const { data, error } = await db.from("drop_in_bookings")
    .select("id,full_name,status,payment_status,created_at,class_meetings!inner(id,title,starts_at,cancelled)")
    .in("status", ["requested", "confirmed"])
    .eq("class_meetings.cancelled", false)
    .gte("class_meetings.starts_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(20);
  if (error) return <section className="panel" id="drop-in-bookings"><h2>Drop-in bookings</h2><p>Bookings could not be loaded. Refresh to try again.</p></section>;
  return <section className="panel" id="drop-in-bookings"><div className="card-heading-row"><div><span className="eyebrow">Upcoming classes · all programs</span><h2>Drop-in bookings</h2></div></div>
    <p>Spots are reserved at signup. Payment is tracked separately.</p>
    {data?.length ? data.map(booking => {
      const meeting = booking.class_meetings as unknown as { id: string; title: string; starts_at: string };
      return <article className="soft-note" key={booking.id}><strong>{booking.full_name}</strong>
        <p>{meeting.title} · {dateLabel.format(new Date(meeting.starts_at))}</p>
        <p>{booking.status === "confirmed" ? "Spot confirmed" : "Waiting for confirmation"} · Payment {booking.payment_status}</p>
        <div className="button-row"><Link href={`/admin/classes?booking=${booking.id}#booking-${booking.id}`}>Review booking →</Link><Link href={`/admin/classes?meeting=${meeting.id}#class-${meeting.id}`}>View class roster →</Link></div>
      </article>;
    }) : <p>No upcoming drop-in bookings.</p>}
    {data?.length === 20 ? <p>Showing the 20 most recent bookings. Open Schedule to see all bookings by program.</p> : null}
  </section>;
}
