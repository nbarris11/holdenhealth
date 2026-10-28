import { safeHttps, type Workout } from "@/lib/challenge";

export default function WorkoutOverview({ workout: w }: { workout: Workout }) {
  const steps = w.steps || [];
  const paragraphs = w.plan
    .replaceAll("\\r\\n", "\n")
    .replaceAll("\\n", "\n")
    .split(/\n\s*\n/)
    .filter((p) => p.trim());
  return (
    <section
      className="workout-overview"
      aria-labelledby="workout-overview-title"
    >
      <header className="workout-overview-heading">
        <div>
          <span className="member-kicker">Your session, step by step</span>
          <h2 id="workout-overview-title">The movement lineup</h2>
        </div>
        {steps.length > 0 && (
          <span className="workout-count">
            {steps.length} steps <span aria-hidden="true">↘</span>
          </span>
        )}
      </header>
      {steps.length > 0 && (
        <ol className="workout-lineup">
          {steps.map((step, index) => (
            <li key={index}>
              <details className="workout-movement">
                <summary>
                  <span className="workout-movement-top">
                    <span className="workout-movement-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="workout-phase">
                      {step.section || "Movement"}
                    </span>
                  </span>
                  <span className="workout-movement-title">{step.title}</span>
                  <span className="workout-movement-dose">{step.dose}</span>
                  <span className="workout-movement-action">
                    <span>How to do it</span>
                    <span className="workout-expand" aria-hidden="true">
                      +
                    </span>
                  </span>
                </summary>
                <div className="workout-movement-body">
                  <p className="member-plan">{step.instructions}</p>
                  {step.easier && (
                    <div className="workout-easier">
                      <strong>Make it yours</strong>
                      <p>{step.easier}</p>
                    </div>
                  )}
                  {safeHttps(step.demo) && (
                    <a
                      className="member-text-link"
                      href={step.demo}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Watch demonstration ↗
                    </a>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
      <details className="workout-coach-notes" open={!steps.length}>
        <summary>
          <span>
            <strong>Before you begin & coach’s notes</strong>
            <small>Preparation, safety, and the complete written plan</small>
          </span>
          <span className="workout-expand" aria-hidden="true">
            +
          </span>
        </summary>
        <div className="workout-note-sections">
          {paragraphs.map((p, i) => (
            <p className="member-plan" key={i}>
              {p}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}
