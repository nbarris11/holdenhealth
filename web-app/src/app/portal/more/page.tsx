import Link from "next/link";
import { signOut } from "@/app/actions";
import { memberData } from "@/lib/member-data";
export default async function More({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const d = await memberData((await searchParams).challenge);
  const links = [
    { href: "/portal/progress", title: "Progress", text: "Your workout history, session history, and wins." },
    ...(d.hasClasses
      ? [{ href: "/portal/session", title: "Class calendar & details", text: "Your class calendar, intake, resources, and payments." }]
      : []),
    ...(d.training
      ? [{ href: "/portal/training", title: "Personal training", text: "Your personal plan, appointments, billing, and coach feedback." }]
      : []),
    {href:"/portal/renew", title:"Join the next 6-week session", text:"Renew with your existing account, or check your registration and payment status."},
    ...(d.participant
      ? [{ href: "/challenge", title: "Habit challenge", text: "Return to your current challenge." }]
      : []),
  ];
  return (
    <main className="member-page">
      <span className="member-kicker">Your people. Your support.</span>
      <h1>Account & support</h1>
      <section className="member-card"><h2>Your contact details</h2><p className="member-plan">Signed in as {d.email}</p><p>Phone: {d.phone || "Not provided"}</p><p>To update your name, phone, email, or email preferences, <a href="mailto:HoldenHealth.Coaching@gmail.com?subject=Update%20my%20account">email Kelsey</a>. Subscription emails also include an unsubscribe link.</p></section>
      <div className="member-stack">
        {links.map((l) => (
          <Link className="member-more-link" href={l.href} key={l.href}>
            <div>
              <strong>{l.title}</strong>
              <p>{l.text}</p>
            </div>
            <span>→</span>
          </Link>
        ))}

      </div>
      <form action={signOut} className="member-actions">
        <button className="member-button secondary">Sign out</button>
      </form>
      <details className="member-card member-privacy"><summary>Privacy &amp; data requests</summary><p>You can ask for a copy of your information, correct a record, or request account or data deletion. <a href="mailto:HoldenHealth.Coaching@gmail.com?subject=Privacy%20and%20data%20request">Email Kelsey with your request</a> from your account email. Please do not include medical details or passwords.</p><p>We may need to verify your identity and retain some records for legal or payment obligations. Clearing your browser does not delete your member records. If you also want to cancel coaching, mention that separately.</p><p><a href="https://holden.health/privacy.html#your-data" target="_blank" rel="noreferrer">Read about your data choices</a></p></details>
    </main>
  );
}
