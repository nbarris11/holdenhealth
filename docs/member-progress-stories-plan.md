# Member progress stories

## Build plan — September 9, 2026

1. Add a first-week preview at `/start`, linked from the public homepage. Visitors choose a life goal and group or personal training. A short-lived, portal-only cookie carries the preset into their signed-in goal form; personal free text is never put in a URL or browser storage.
2. Extend Progress with a member-confirmed goal, the original reason for starting, a six-week activity summary, private personal wins, and published coach recaps. Offer existing intake/training goals as suggestions, never silently rewrite them.
3. Add `/admin/stories` and a member detail view. Show actual completion, confirmed attendance, and member-authored wins/check-ins. Kelsey can prepare a private draft, preview it, and publish a written recap to that member's Progress screen.
4. Store goals, wins, and recaps in additive tables with row-level security. Members cannot read other accounts or drafts, and cannot author coach messages. Preserve published recap snapshots and original goals.
5. Verify date boundaries, counting, empty states, member/admin flows, mobile layout, and database allow/deny rules. Deploy using the existing root commands after checks pass.

## First release boundaries

- Written coach messages; no recording, uploads, AI-authored coaching, or automatic outreach.
- Six-week summaries use saved activity only. Partial sessions remain separate. Only attendance explicitly marked attended counts as a class.
- Personal wins and check-ins are labeled as the member's words. No inferred strength increases or medical outcomes.
- Recaps preserve their goal, period, and totals at publication; newer activity does not change historical recaps.
- Goal changes preserve the original goal. Members can remove a personal win; published recaps contain aggregate counts, not copied private win text.
- Existing workouts, intake, checkout, email delivery, and hosting architecture stay intact.

## Pilot

Start with five willing clients. Kelsey writes a recap at a natural training-block review. Ask whether it helped each client recognize progress and whether the workflow saved Kelsey preparation time. No messages are automatically sent by this release.
