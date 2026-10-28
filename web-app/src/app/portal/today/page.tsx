import MemberAnnouncements from "@/components/member-announcements";
import Image from "next/image";
import GroupNextStep from "@/components/group-next-step";
import Link from "next/link";
import { memberData } from "@/lib/member-data";
import { addDays, dateLabel, detroitToday } from "@/lib/challenge";
import { mondayOf } from "@/lib/workout-app";
import { EmptyWorkouts, ProgramPicker } from "@/components/member-shared";
import { StoryTodayCard } from "@/components/progress-story";
import { createClient } from "@/lib/supabase/server";
export default async function Today({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const d = await memberData((await searchParams).challenge);
  const trainingSetup = d.training ? await Promise.all([
    (await createClient()).from("personal_training_intakes").select("submitted_at").eq("relationship_id", d.training.id).maybeSingle(),
    (await createClient()).from("risk_agreements").select("signed_at").eq("relationship_id", d.training.id).maybeSingle(),
  ]) : null;
  if (trainingSetup?.some(result => result.error)) throw new Error("Your personal training setup status could not be loaded.");
  const trainingIntake = trainingSetup?.[0].data;
  const trainingAgreement = trainingSetup?.[1].data;
  const week = mondayOf(d.today),
    completed = d.logs.filter((l) => l.status === "completed");
  const trainingDays = d.trainingLogs.map((l) =>
    detroitToday(new Date(l.completed_at)),
  );
  const count =
    completed.filter((l) => l.performed_on >= week).length +
    trainingDays.filter((day) => day >= week).length;
  const workout =
    d.workouts.find(
      (w) =>
        !completed.some((l) => l.workout_id === w.id && l.performed_on >= week),
    ) ?? d.workouts[0];
  const suffix = d.challenge ? `?challenge=${d.challenge.id}` : "";
  const habits = d.marks.filter((m) => m.day === d.today && m.completed).length;
  return (
    <main className="member-page member-today">
      <header className="member-greeting today-personal-greeting">
        <div>
          <span className="member-kicker">
            {dateLabel(d.today)} · Your daily practice
          </span>
          <h1>Hi, {d.firstName}.</h1>
        </div>
        <Link
          className="today-coach-profile"
          href={`/portal/more${d.challenge ? `?challenge=${d.challenge.id}` : ""}`}
          aria-label="Get support from your coach Kelsey"
        >
          <Image
            src="/coach/kelsey.jpg"
            width={60}
            height={60}
            alt="Kelsey Holden"
            priority
          />
          <span>Your coach</span>
        </Link>
      </header>
      <MemberAnnouncements />
      <GroupNextStep />
      {d.training && (!trainingIntake || !trainingAgreement) && <section className="member-card"><span className="member-kicker">Personal training setup</span><h2>{trainingIntake ? "Sign your Assumption of Risk" : "Complete your private intake"}</h2><p>{trainingIntake ? "Your intake is saved. Please review and sign the agreement before training." : "Share your goals and health details so Kelsey can plan your training."}</p><Link className="member-button" href="/portal/training/intake">{trainingIntake ? "Review agreement →" : "Start my intake →"}</Link></section>}
      <section className="member-card">
        <span className="member-kicker">Keep your momentum</span>
        <h2>Ready for your next group session?</h2>
        <p>Keep your progress going with another 6-week group session. Renew with your existing account.</p>
        <Link className="member-button secondary" href="/portal/renew">Join the next 6-week session →</Link>
        <div className="member-actions">
          <a className="member-text-link" href="https://www.holden.health/fitness-coaching.html">
            Group classes don’t fit your schedule? Explore online coaching instead →
          </a>
        </div>
      </section>
      <StoryTodayCard challengeId={d.challenge?.id} />
      {d.challenge && (
        <details className="today-program-details">
          <summary>
            Your program <span>{d.challenge.title}</span>
          </summary>
          <ProgramPicker joined={d.joined} current={d.challenge} />
          <p className="member-muted">
            {d.challenge.title} · {dateLabel(d.challenge.starts_on)}–
            {dateLabel(d.challenge.ends_on)}
            {d.today < d.challenge.starts_on
              ? " · Starting soon"
              : d.today > d.challenge.ends_on
                ? " · Finished"
                : ""}
          </p>
        </details>
      )}
      <div className="member-grid">
        <section>
          {d.nextTraining ? (
            <div className="member-card member-feature">
              <span className="member-kicker">
                Your personal plan · {dateLabel(d.nextTraining.scheduled_for)}
              </span>
              <h2>{d.nextTraining.title}</h2>
              <p>
                {d.nextTraining.focus ||
                  "Choose the version that fits your day."}
              </p>
              <p>
                Plan {d.nextTraining.recommended_option} is recommended. Your
                shorter options are here, too.
              </p>
              <Link
                className="member-button light"
                href={`/portal/training#workout-${d.nextTraining.id}`}
              >
                Open my session →
              </Link>
            </div>
          ) : workout ? (
            <div className="member-card member-feature">
              <span className="member-kicker">Your next workout</span>
              <div className="member-meta">
                <span>{workout.minutes} minutes</span>
                <span>·</span>
                <span>{workout.level || "All levels"}</span>
              </div>
              <h2>{workout.title}</h2>
              <p>{workout.equipment || "Move at your own pace."}</p>
              <Link
                className="member-button light"
                href={`/portal/workouts/${workout.id}${suffix}`}
              >
                Let’s move →
              </Link>
              <p>
                A shorter session counts, too. Choose what works for you today.
              </p>
            </div>
          ) : (
            <EmptyWorkouts challenge={d.challenge} classProgram={d.classPrograms[0]} />
          )}
        </section>
        <section className="member-card">
          <span className="member-kicker">Your week</span>
          <h2>
            {count} {count === 1 ? "workout" : "workouts"} completed
          </h2>
          <p className="member-muted">
            {d.participant
              ? `Your intention: ${d.participant.weekly_workouts} each week. No need for a perfect streak.`
              : "Small steps build consistency."}
          </p>
          <div className="member-week">
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(week, i);
              const done =
                completed.some((l) => l.performed_on === day) ||
                trainingDays.includes(day);
              return (
                <div
                  key={day}
                  className={`member-day ${done ? "done" : ""} ${day === d.today ? "today" : ""}`}
                  aria-label={`${dateLabel(day)}${done ? ", workout completed" : ""}${day === d.today ? ", today" : ""}`}
                >
                  <span>{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
                  <strong>{done ? "✓" : Number(day.slice(-2))}</strong>
                </div>
              );
            })}
          </div>
          <Link className="member-text-link" href={`/portal/progress${suffix}`}>
            See your progress →
          </Link>
        </section>
      </div>
      {d.training && <section className="member-card"><h2>Personal training habits</h2><p>Choose your three habits and check them off each day.</p><Link className="member-button secondary" href="/portal/training/habits">Open my PT habits →</Link></section>}
      {d.hasClasses && d.participant && <section className="member-card"><span className="member-kicker">Your six-week session</span><h2>Weekly habits</h2><p>Choose your habits, check them off each day, and see how many days worked for you this week.</p><Link className="member-button secondary" href="/portal/habits">Check off my weekly habits →</Link></section>}
      <div className="member-grid">
        <section className="member-card">
          <div className="member-section-heading">
            <div>
              <span className="member-kicker">Daily practice</span>
              <h2>{d.hasClasses && !d.participant ? "Your weekly habits" : "Your three habits"}</h2>
            </div>
            {d.participant && <span className="member-pill green">{d.challenge && d.today < d.challenge.starts_on ? `Opens ${dateLabel(d.challenge.starts_on)}` : `${habits}/3 today`}</span>}
          </div>
          <p>
            {d.participant
              ? d.participant.goals.join(" · ")
              : d.hasClasses ? "Choose three small habits for your six-week session. Check them off each day and review your progress every week." : "Choose three small habits when you join a challenge."}
          </p>
          <Link
            className="member-button secondary"
            href={d.participant || d.hasClasses ? `/portal/habits${suffix}` : "/challenge"}
          >
            {d.participant ? d.challenge && d.today < d.challenge.starts_on ? "Preview my habits" : "Check in with yourself" : d.hasClasses ? "Check off my weekly habits" : "Choose your habits"}
          </Link>
        </section>
        <section className="member-card">
          <div className="today-coach-byline">
            <Image src="/coach/kelsey.jpg" width={44} height={44} alt="" />
            <span className="member-kicker">From Kelsey</span>
          </div>
          <h2>You don’t have to do it all.</h2>
          <p className="member-plan">
            {d.challenge?.welcome ||
              "Start where you are. Your classes, training plan, and support are all here when you need them."}
          </p>
          <div className="member-actions">
            {d.hasClasses && (
              <Link
                className="member-text-link"
                href="/portal/session#class-calendar"
              >
                Class calendar →
              </Link>
            )}
            {d.training && (
              <Link className="member-text-link" href="/portal/training">
                Your personal plan →
              </Link>
            )}
            <Link className="member-text-link" href={`/portal/more${suffix}`}>
              Support & account →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
