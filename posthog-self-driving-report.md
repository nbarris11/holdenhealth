> Historical wizard output. Final privacy and member-identification behavior supersedes this report: see [release record](docs/posthog-release-2026-09-11.md). Raw error capture is disabled.

# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured with Session Replay, Error Tracking, and Support enabled, along with health, error, and support signal sources. The browser SDK now permits exception capture while retaining the portal's existing masking and anonymous replay safeguards.

Findings will begin appearing in the [Self-driving inbox](https://us.posthog.com/project/605056/inbox) within about 30 minutes as fresh scouts run and eligible source data arrives.

## AI data processing

Approved. The wizard's organization-level AI data-processing gate was satisfied before this setup began.

## GitHub

Connected before this setup. No GitHub Issues responder was enabled because no optional issue-tracker integration was selected in this run.

## Products enabled

| Product | Result | SDK check |
|---|---|---|
| Session Replay | already enabled | Browser initialization already keeps `disable_session_recording: false`; existing input, text, attribute, image, media, network-body, and header masking remain in place. |
| Error Tracking | enabled | Updated the browser initialization so `capture_exceptions` is enabled. |
| Support | enabled | Tickets will begin arriving only after an inbound email, inbox, or Slack channel is connected in PostHog. |

## Signal sources

| Source product | Source type | Action |
|---|---|---|
| `health_checks` | `health_issue` | Enabled. |
| `error_tracking` | `issue_created` | Enabled. |
| `error_tracking` | `issue_reopened` | Enabled. |
| `error_tracking` | `issue_spiking` | Enabled. |
| `conversations` | `ticket` | Enabled; dormant until a Support inbound channel is connected. |
| `signals_scout` | `cross_source_issue` | No row created; this scout gate is on by default. |
| `session_replay` | `session_analysis_cluster` | Deliberately skipped; this retired source is not used. Replay coverage belongs to Replay Vision scanners. |
| `replay_vision` | — | No source row created; scanners self-authorize through `emits_signals`. |

## Connected tools

No optional connected tools were selected. No warehouse source or responder was created for GitHub Issues, Linear, Jira, Sentry, Zendesk, or another external tool.

## Scout troop

**Active scouts (3):**

| Scout | Why it is enabled |
|---|---|
| `signals-scout-general` | Cross-product correlations and otherwise unclaimed surfaces. |
| `signals-scout-product-analytics` | The portal captures core interaction, enrollment, member, and challenge events. |
| `signals-scout-revenue-analytics` | The product uses a payment provider and records payment lifecycle events. |

**Disabled scouts (24):**

| Scout(s) | Reason |
|---|---|
| `signals-scout-error-tracking` | Covered by the native Error Tracking sources above. |
| `signals-scout-session-replay` | Covered by Replay Vision scanners once they are created; no duplicate route was enabled. |
| `signals-scout-ai-observability`, `signals-scout-apm`, `signals-scout-logs` | No evidence that these product surfaces are in use. |
| `signals-scout-conversations` | Support is enabled but has no inbound channel yet. |
| `signals-scout-csp-violations` | No Content Security Policy reporting configuration was found. |
| `signals-scout-customer-analytics`, `signals-scout-data-pipelines`, `signals-scout-data-warehouse` | No corresponding account-analytics, pipeline, or warehouse surface is configured. |
| `signals-scout-experiments`, `signals-scout-feature-flags`, `signals-scout-surveys` | No active use was found. |
| `signals-scout-anomaly-detection`, `signals-scout-health-checks`, `signals-scout-observability-gaps`, `signals-scout-inbox-validation`, `signals-scout-insight-alerts` | Not selected for this fresh, focused setup; health is already covered by its native source. |
| `signals-scout-mcp-tool-calls`, `signals-scout-skills-store`, `signals-scout-tasks` | No matching operating surface was found. |
| `signals-scout-replay-vision` | No prior scanner observations exist; it remains off until a useful Replay Vision history accumulates. |
| `signals-scout-web-analytics`, `signals-scout-web-vitals` | The browser configuration does not collect pageviews or performance data, so these would not be useful now. |

**Run budget:** 100 maximum runs per day; 0 used and 100 remaining at setup time. The project is enrolled. The current banner says: “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

## Custom scouts

No custom scouts were created. Two candidates were proposed and declined:

- **Enrollment completion and member readiness:** would watch the handoff from enrollment start through payment and confidential intake, using a materially weaker expected next-step rate as its discriminator. This complements, rather than duplicates, the revenue scout.
- **Member challenge engagement after joining:** would watch whether newly joined participants continue into habit and workout activity, using a sharp drop in follow-through while new joins remain stable as its discriminator.

Other surfaces were ruled out because they are already routed to native Error Tracking or Replay Vision, have no evidence of active use, or lack a clear domain-specific discriminator. If a future custom scout proves noisy, set `emit: false` on its scout config to turn it into a dry run.

## Replay Vision scanners

A scanner is an LLM that watches individual session recordings on a schedule and pushes high-confidence findings to the inbox. Scanners are the only part of this setup that spends Replay Vision quota; individual findings carry half weight and need independent corroboration before promotion into an inbox report.

| Required monitor | Status | Scope and estimate |
|---|---|---|
| Breakage monitor | Skipped | The required shared scanner brief was unavailable in this runtime, so its locked prompt and completion-flow query could not be applied safely. No estimate was created. |
| Frustration monitor | Skipped | The required shared scanner brief was unavailable in this runtime, so its locked prompt and rage-click query could not be applied safely. No estimate was created. |

Session recordings are available and Session Replay is enabled. Replay Vision has 2,500 credits remaining for the current period, with 0 credits used, so there is available budget when the two standard monitors are created. There were no existing scanners to update.

## Follow-ups

- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog so the enabled Support ticket responder can receive tickets.
- [ ] Create the standard Replay Vision breakage and frustration monitors using the required shared briefs, with `emits_signals: true`; use the [Replay Vision setup guide](https://posthog.com/docs/replay-vision/start-here) for the supported scanner workflow.
- [ ] Enable additional built-in scouts from the inbox if the project adopts feature flags, experiments, surveys, web analytics, logs, AI observability, pipelines, or another corresponding product surface.
- [ ] Revisit either declined custom-scout candidate if enrollment readiness or ongoing member engagement becomes a recurring operational concern.

## What happens next

The scout coordinator picks up fresh configurations within about 30 minutes. Scout runs consume the shared daily run budget, findings cluster into reports in the Self-driving inbox, and immediately actionable reports can start coding tasks.

## Files modified or created

| File | Change |
|---|---|
| `web-app/src/instrumentation-client.ts` | Enabled browser exception capture; retained existing replay privacy protections. |
| `posthog-self-driving-report.md` | Created this setup report. |
