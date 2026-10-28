import { challengePageContentKey, normalizeChallengePageCopy } from "@/lib/challenge-page-copy";
import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  dateLabel,
  detroitToday,
  isUuid,
  safeHttps,
  type Challenge,
  type Participant,
  type Workout,
  type Checkmark,
} from "@/lib/challenge";
import { EmailForm, JoinForm } from "./forms";
import Tracker from "./tracker";
import { signOut } from "@/app/actions";
import "./style.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "14-day habit challenge | Holden Health" };
export default async function ChallengePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const db = await createClient();
  const { data: pageContent } = await db.from("site_content").select("value").eq("content_key", challengePageContentKey).eq("published", true).maybeSingle();
  const copy = normalizeChallengePageCopy(pageContent?.value);
  const today = detroitToday();
  const { data: auth } = await db.auth.getClaims();
  const userId = auth?.claims?.sub;
  const { data: role } = userId
    ? await db
        .from("staff_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle()
    : { data: null };
  const preview = Boolean(role && params.preview === "1");
  let query = db.from("habit_challenges").select("*");
  if (typeof params.id === "string" && isUuid(params.id))
    query = query.eq("id", params.id);
  else
    query = query
      .eq("published", true)
      .order("starts_on", { ascending: false })
      .limit(1);
  const { data: challenges, error } = await query;
  const challenge = challenges?.[0] as Challenge | undefined;
  if (error)
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>The challenge could not be loaded.</h1>
          <p>Please try again shortly.</p>
          <Link href="/">{copy.home_button}</Link>
        </section>
      </main>
    );
  if (!challenge || (!challenge.published && !preview))
    return (
      <main className="app-shell">
        <section className="panel">
          <span className="eyebrow">Holden Health</span>
          <h1>{copy.empty_heading}</h1>
          <p>{copy.empty_body}</p>
          <div className="button-row">
            <Link className="button primary" href="/login">{copy.login_button}</Link>
            <Link className="button secondary" href="/">{copy.home_button}</Link>
          </div>
        </section>
      </main>
    );
  const { data: participantData, error: participantError } = userId
    ? await db
        .from("challenge_participants")
        .select("*")
        .eq("challenge_id", challenge.id)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null, error: null };
  if (participantError) throw new Error("Unable to load challenge enrollment.");
  const participant = participantData as Participant | null;
  if (participant && !preview)
    redirect(`/portal/workouts?challenge=${challenge.id}`);
  const [
    { data: markData, error: markError },
    { data: workoutData, error: workoutError },
  ] = await Promise.all([
    participant
      ? db
          .from("challenge_checkmarks")
          .select("*")
          .eq("participant_id", participant.id)
      : Promise.resolve({ data: [], error: null }),
    participant || preview
      ? db
          .from("challenge_workouts")
          .select("*")
          .eq("challenge_id", challenge.id)
          .eq("archived", false)
          .order("publish_on", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (markError || workoutError)
    throw new Error("Unable to load saved challenge content.");
  const workouts = (workoutData || []) as Workout[];
  return (
    <main className="app-shell challenge-shell challenge-editable-copy">
      <header className="app-header">
        <BrandLogo className="wordmark" href="/" />
        <div className="button-row">
          {role && (
            <Link
              className="button secondary"
              href={`/admin/challenges?id=${challenge.id}`}
            >
              Manage challenge
            </Link>
          )}
          {userId && (
            <>
              <Link className="button secondary" href="/portal">
                My portal
              </Link>
              <form action={signOut}>
                <button className="button secondary">Sign out</button>
              </form>
            </>
          )}
        </div>
      </header>
      {preview && (
        <aside className="preview-banner">
          <strong>Participant preview</strong>
          <span>
            Read-only. Draft settings are visible to you; no participation is
            recorded.
          </span>
        </aside>
      )}
      <section className="challenge-intro">
        <span className="eyebrow">
          {dateLabel(challenge.starts_on)} – {dateLabel(challenge.ends_on)} ·
          Free
        </span>
        <h1>
          {participant
            ? `Small habits. Real progress, ${participant.display_name.split(" ")[0]}.`
            : challenge.title}
        </h1>
        <p>{copy.intro}</p>
      </section>
      {!participant && !preview ? (
        <div className="challenge-columns">
          <section className="panel">
            <h2>
              {userId
                ? copy.goals_heading
                : copy.signup_heading}
            </h2>
            {!userId ? (
              <>
                <p>{copy.signup_intro}</p>
                <EmailForm challengeId={challenge.id} copy={copy} />
              </>
            ) : challenge.signup_open && today <= challenge.ends_on ? (
              <JoinForm challenge={challenge} copy={copy} />
            ) : (
              <p>{copy.signup_closed}</p>
            )}
          </section>
          <aside>
            <section className="panel challenge-note">
              <h2>{copy.note_heading}</h2>
              <p className="challenge-preserve">{challenge.welcome}</p>
              {role && (
                <Link href={`/admin/challenges?id=${challenge.id}#kelsey-note`}>
                  Edit this note
                </Link>
              )}
            </section>
            <section className="panel">
              <h3>{copy.support_heading}</h3>
              {role && <Link href="/admin/challenges#page-wording">Edit page wording</Link>}
              <p>{copy.support_body}</p>
              <p>{copy.support_dates}</p>
            </section>
          </aside>
        </div>
      ) : (
        <>
          <nav className="section-nav">
            <a href="#goals">{copy.habits_nav}</a>
            <a href="#workouts">{copy.workouts_nav}</a>
            <a href="#community">{copy.community_nav}</a>
          </nav>
          <div className="challenge-columns">
            <div id="goals">
              {participant && !preview ? (
                <Tracker
                  challenge={challenge}
                  participant={participant}
                  marks={(markData || []) as Checkmark[]}
                  today={today}
                />
              ) : (
                <section className="panel">
                  <h2>{copy.preview_goals_heading}</h2>
                  <p>{copy.preview_goals_body}</p>
                  {challenge.goal_options.slice(0, 3).map((g) => (
                    <label className="challenge-goal" key={g.label}>
                      <input type="checkbox" disabled />
                      <span>{g.label}</span>
                    </label>
                  ))}
                  <p className="fine-print">
                    Example selection · Daily tracking begins{" "}
                    {dateLabel(challenge.starts_on)}.
                  </p>
                </section>
              )}
              <section className="panel" id="workouts">
                <h2>{copy.workouts_heading}</h2>
                {workouts.length ? (
                  workouts.map((w) => (
                    <details className="challenge-workout" key={w.id}>
                      <summary>
                        <strong>{w.title}</strong>
                        <span>
                          {w.minutes} min · {w.equipment || "No equipment"} ·{" "}
                          {dateLabel(w.publish_on)}
                        </span>
                      </summary>
                      <p className="challenge-preserve">{w.plan}</p>
                      <p>
                        {!w.published
                          ? "Draft"
                          : w.publish_on > today
                            ? `Scheduled for ${dateLabel(w.publish_on)}`
                            : "Available now"}
                      </p>
                      <Link
                        className="button primary"
                        href={`/portal/workouts/${w.id}?preview=1`}
                      >
                        Preview guided workout
                      </Link>
                      {w.exercises
                        .filter((e) => safeHttps(e.url))
                        .map((e, i) => (
                          <p key={i}>
                            <a
                              href={e.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {e.label} ↗
                            </a>
                          </p>
                        ))}
                    </details>
                  ))
                ) : (
                  <p>{copy.workouts_empty}</p>
                )}
              </section>
            </div>
            <aside>
              <section className="panel challenge-note">
                <span className="eyebrow">{copy.note_heading}</span>
                <p className="challenge-preserve">{challenge.welcome}</p>
                {role && (
                  <p>
                    <Link href={`/admin/challenges?id=${challenge.id}#kelsey-note`}>
                      Edit this note
                    </Link>
                  </p>
                )}
                <strong>{copy.note_signoff}</strong>
              </section>
              <section className="panel">
                <h2 id="community">{copy.includes_heading}</h2>
                <p>{copy.includes_body}</p>
              </section>
              <section className="panel">
                <h2>
                  {today > challenge.ends_on
                    ? copy.ended_heading
                    : copy.next_heading}
                </h2>
                <p>{copy.next_body}</p>
                <div className="stack-form">
                  <Link className="button primary" href="/register">{copy.classes_button}</Link>
                  <Link className="button secondary" href="/online-training">{copy.training_button}</Link>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
