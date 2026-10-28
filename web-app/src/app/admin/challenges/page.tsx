import PageCopyForm from "./page-copy-form";
import { challengePageContentKey, normalizeChallengePageCopy } from "@/lib/challenge-page-copy";
import { LibraryPicker } from "./library-controls";
import { cleanLibraryContent } from "@/lib/workout-library";
import { isUuid } from "@/lib/challenge";
import Link from "next/link";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  dateLabel,
  detroitToday,
  type Challenge,
  type Participant,
  type Workout,
  type Checkmark,
} from "@/lib/challenge";
import { SettingsForm, WorkoutForm, ArchiveForm } from "./forms";
import type { WorkoutLog } from "@/lib/workout-app";
import "@/app/challenge/style.css";
export default async function ChallengesAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await verifyAdmin();
  const params = await searchParams;
  const db = await createClient();
  const { data, error } = await db
    .from("habit_challenges")
    .select("*")
    .order("starts_on", { ascending: false });
  if (error)
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>Challenges aren’t available yet.</h1>
          <p>
            The challenge database setup must be completed before you can manage
            content.
          </p>
        </section>
      </main>
    );
  const { data: pageContent, error: pageContentError } = await db.from("site_content").select("value").eq("content_key", challengePageContentKey).maybeSingle();
  const challenges = (data || []) as Challenge[];
  const challenge =
    params.new === "1"
      ? undefined
      : challenges.find((c) => c.id === params.id) || challenges[0];
  const [
    { data: people, error: peopleError },
    { data: plans, error: plansError },
  ] = challenge
    ? await Promise.all([
        db
          .from("challenge_participants")
          .select("*")
          .eq("challenge_id", challenge.id)
          .order("joined_on"),
        db
          .from("challenge_workouts")
          .select("*")
          .eq("challenge_id", challenge.id)
          .order("publish_on"),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (peopleError || plansError)
    throw new Error("Challenge records could not be loaded.");
  const templateId =
    typeof params.template === "string" && isUuid(params.template)
      ? params.template
      : undefined;
  const { data: savedTemplate } = templateId
    ? await db
        .from("workout_library")
        .select("content")
        .eq("id", templateId)
        .eq("kind", "workout")
        .maybeSingle()
    : { data: null };
  const template = savedTemplate
    ? cleanLibraryContent("workout", savedTemplate.content)?.template
    : undefined;
  const participants = (people || []) as Participant[];
  const workouts = (plans || []) as Workout[];
  const { data: checks, error: checksError } = participants.length
    ? await db
        .from("challenge_checkmarks")
        .select("*")
        .in(
          "participant_id",
          participants.map((p) => p.id),
        )
        .eq("completed", true)
    : { data: [], error: null };
  if (checksError)
    throw new Error("Participation progress could not be loaded.");
  const marks = (checks || []) as Checkmark[];
  const { data: logRows, error: logsError } = participants.length
    ? await db
        .from("challenge_workout_logs")
        .select("*")
        .in(
          "participant_id",
          participants.map((p) => p.id),
        )
        .order("completed_at", { ascending: false })
    : { data: [], error: null };
  if (logsError) throw new Error("Workout reports could not be loaded.");
  const logs = (logRows || []) as WorkoutLog[];
  return (
    <main className="app-shell workspace-page challenge-shell">
      <header className="workspace-page-header">
        <span className="eyebrow">Kelsey’s workspace</span>
        <h1>Challenges</h1>
        <p>Free habits, at-home workouts, and support between sessions.</p>
        <div className="button-row">
          <a className="button primary" href="#program-information">
            Edit program information
          </a>
          <a className="button secondary" href="#page-wording">Edit page wording</a>
          <a className="button secondary" href="#challenge-workouts">
            Edit workouts
          </a>
          <Link className="button secondary" href="/admin/challenges?new=1">
            Create a challenge
          </Link>
          {challenge && (
            <Link
              className="button secondary"
              href={`/challenge?id=${challenge.id}&preview=1`}
            >
              Preview as participant
            </Link>
          )}
        </div>
      </header>
      <nav className="section-nav">
        {challenges.map((c) => (
          <Link key={c.id} href={`/admin/challenges?id=${c.id}`}>
            {c.title} · {dateLabel(c.starts_on)}
            {c.archived ? " · Archived" : !c.published ? " · Draft" : ""}
          </Link>
        ))}
      </nav>
      <section className="panel" id="page-wording">
        <details open>
          <summary><strong>Challenge page wording — including A little support at home</strong></summary>
          <p>These words are shared by all free challenge pages. Changes go live when you choose Save page wording. The challenge name, dates, Kelsey’s message, habits, and workouts are edited separately below.</p>
          <p>Signup rules, progress counts, privacy notices, and error messages follow the app’s settings.</p>
          <a href="/challenge" target="_blank" rel="noreferrer">View the live signup page ↗</a>
          {pageContentError ? <p role="alert">Saved page wording could not be loaded. Refresh before editing.</p> : <PageCopyForm copy={normalizeChallengePageCopy(pageContent?.value)} />}
        </details>
      </section>
      <div className="challenge-admin-grid">
        <section className="panel" id="program-information">
          <h2>{challenge ? "Edit program information" : "New challenge"}</h2>
          <p>
            Update the challenge name, “A note from Kelsey” message, and habit
            choices here. Workout plans have their own section.
          </p>
          <SettingsForm
            key={
              challenge
                ? `${challenge.id}-${Boolean(challenge.archived)}`
                : "new"
            }
            challenge={challenge}
            locked={participants.length > 0}
            defaults={
              challenges[0]?.goal_options || [
                { category: "Movement", label: "Get outside for a walk" },
                {
                  category: "Nutrition",
                  label: "Eat a protein-rich food at each meal",
                },
                {
                  category: "Self-care",
                  label: "Take 10 minutes just for YOU",
                },
              ]
            }
          />
          {challenge && (
            <ArchiveForm
              id={challenge.id}
              kind="challenge"
              archived={Boolean(challenge.archived)}
            />
          )}
        </section>
        <section className="panel" id="challenge-workouts">
          <h2>Challenge workouts</h2>
          {challenge ? (
            <>
              <p>
                {workouts.length} plans · Workouts appear automatically on their
                publish date.
              </p>
              <LibraryPicker kind="workout" challengeId={challenge.id} />
              {params.template && !template && (
                <p role="alert">
                  That template could not be loaded. Choose another from the
                  library.
                </p>
              )}
              {workouts.map((w) => (
                <details className="challenge-editor" key={w.id}>
                  <summary>
                    {w.title} · {dateLabel(w.publish_on)} ·{" "}
                    {w.archived
                      ? "Archived"
                      : w.published
                        ? w.publish_on > detroitToday()
                          ? "Scheduled"
                          : "Published"
                        : "Draft"}
                  </summary>
                  <WorkoutForm
                    key={`${w.id}-${Boolean(w.archived)}`}
                    challenge={challenge}
                    workout={w}
                  />
                  <div className="button-row">
                    <Link
                      className="button secondary"
                      href={`/portal/workouts/${w.id}?preview=1`}
                    >
                      Preview workout & session
                    </Link>
                  </div>
                  <ArchiveForm
                    id={w.id}
                    kind="workout"
                    archived={Boolean(w.archived)}
                  />
                </details>
              ))}
              <details
                className="challenge-editor"
                id="new-workout"
                open={Boolean(template)}
              >
                <summary>
                  {template
                    ? `New draft from ${template.title}`
                    : "+ Add a workout"}
                </summary>
                <WorkoutForm
                  key={`${challenge.id}-${templateId || "new"}`}
                  challenge={challenge}
                  template={template}
                />
              </details>
            </>
          ) : (
            <p>Save your challenge first, then add workouts.</p>
          )}
        </section>
      </div>
      {challenge && (
        <section className="panel">
          <h2>Participants · {participants.length}</h2>
          <p>
            Completed days count only when all three habits are checked. Days
            before joining are excluded.
          </p>
          {participants.length ? (
            <div className="challenge-admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Joined</th>
                    <th>Daily habits</th>
                    <th>Weekly workouts</th>
                    <th>Completed days</th>
                    <th>Workout sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => {
                    const counts = new Map<string, number>();
                    marks
                      .filter((m) => m.participant_id === p.id)
                      .forEach((m) =>
                        counts.set(m.day, (counts.get(m.day) || 0) + 1),
                      );
                    const first =
                      p.joined_on > challenge.starts_on
                        ? p.joined_on
                        : challenge.starts_on;
                    const last =
                      detroitToday() < challenge.ends_on
                        ? detroitToday()
                        : challenge.ends_on;
                    const eligible = Math.max(
                      0,
                      Math.round(
                        (Date.parse(last) - Date.parse(first)) / 86400000,
                      ) + 1,
                    );
                    return (
                      <tr key={p.id}>
                        <td><Link href={`/admin/people/${p.user_id}`}>{p.display_name}</Link></td>
                        <td>{dateLabel(p.joined_on)}</td>
                        <td>
                          <ul>
                            {p.goals.map((g) => (
                              <li key={g}>{g}</li>
                            ))}
                          </ul>
                        </td>
                        <td>{p.weekly_workouts}</td>
                        <td>
                          {[...counts.values()].filter((n) => n === 3).length} /{" "}
                          {eligible}
                        </td>
                        <td>
                          {
                            logs.filter(
                              (l) =>
                                l.participant_id === p.id &&
                                l.status === "completed",
                            ).length
                          }{" "}
                          complete ·{" "}
                          {
                            logs.filter(
                              (l) =>
                                l.participant_id === p.id &&
                                l.status === "partial",
                            ).length
                          }{" "}
                          partial
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No participants yet. Open signup when the challenge is ready.</p>
          )}
        </section>
      )}
      {challenge && (
        <section className="panel">
          <h2>Workout check-ins</h2>
          <p>
            Member-reported sessions. Partial sessions do not count toward the
            weekly completed-workout total.
          </p>
          {logs.length ? (
            <div className="challenge-admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Date</th>
                    <th>Workout</th>
                    <th>Result</th>
                    <th>Time</th>
                    <th>Effort</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {
                          participants.find((p) => p.id === l.participant_id)
                            ?.display_name
                        }
                      </td>
                      <td>{dateLabel(l.performed_on)}</td>
                      <td>
                        {l.workout_title} · v{l.workout_revision}
                      </td>
                      <td>{l.status}</td>
                      <td>
                        {Math.floor(l.elapsed_seconds / 60)}m{" "}
                        {l.elapsed_seconds % 60}s
                      </td>
                      <td>{l.effort ? `${l.effort}/10` : "—"}</td>
                      <td>{l.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No workout check-ins yet.</p>
          )}
        </section>
      )}
    </main>
  );
}
