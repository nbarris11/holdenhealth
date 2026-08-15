import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";

export default async function AdminPage() {
  await verifyAdmin();
  const supabase = await createClient();
  const [{ count: enrolled }, { count: paid }, { count: checkIns }] = await Promise.all([
    supabase.from("enrollments").select("id", { count: "exact", head: true }).in("status", ["invited", "active"]),
    supabase.from("payment_records").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("check_ins").select("id", { count: "exact", head: true }).is("reviewed_at", null),
  ]);

  return (
    <main className="app-shell">
      <header className="app-header"><div><span className="eyebrow">Kelsey’s dashboard</span><h1>Focus on You</h1></div><form action={signOut}><button className="button secondary" type="submit">Sign out</button></form></header>
      <div className="stat-grid"><section className="panel"><span>Enrolled</span><strong>{enrolled ?? 0}</strong></section><section className="panel"><span>Paid</span><strong>{paid ?? 0}</strong></section><section className="panel"><span>Check-ins to review</span><strong>{checkIns ?? 0}</strong></section></div>
      <section className="panel hero-panel"><span className="eyebrow">Admin foundation ready</span><h2>Roster, payment tracking, check-ins, and announcements come next.</h2><p>This route is protected by both a verified Supabase session and the database administrator role.</p></section>
    </main>
  );
}
