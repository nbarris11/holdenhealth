import Link from "next/link";
import { signOut } from "@/app/actions";
import { memberData } from "@/lib/member-data";
import { hasChatAccess } from "@/lib/chat-access";
export default async function More({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const d = await memberData((await searchParams).challenge);
  const canChat = await hasChatAccess();
  const links = [
    {href:"/portal/renew", title:"Join the next 6-week session", text:"Renew with your existing account, or check your registration and payment status."},
    ...(d.hasClasses
      ? [
          { href: "/portal/habits", title: "Weekly habits", text: "Choose habits, check off each day, and review your weekly progress." },
          {
            href: "/portal/session",
            title: "Classes & membership",
            text: "Your calendar, intake, resources, payments, and check-ins.",
          },
        ]
      : []),
    ...(d.training
      ? [
          {
            href: "/portal/training",
            title: "Personal training",
            text: "Your personal plan, workout logs, and coach feedback.",
          },
        ]
      : []),
    {
      href: "/challenge",
      title: "Habit challenges",
      text: "Explore the next challenge or return to your current one.",
    },
    ...(canChat ? [{
      href: "/portal/communicate",
      title: "Messaging",
      text: "Message Kelsey privately or catch up with your program group.",
    }] : []),
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
