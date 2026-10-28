# Workout encouragement — September 9, 2026

## Superseded: encouragement removed at user request

The user disliked the encouragement option and requested its removal. Removed the voice toggle, speech hook, replay, rotating written messages, and their styles. Timer, next-movement and save chimes remain, with the existing Sound toggle. No save/data changes. Lint and production build passed. The original release record below is historical.

Added subtle ascending next-movement tones, a four-note completed-save celebration, and a gentler three-note partial-save cue to the shared member/demo player. Existing timer cues and per-member sound preference remain. Audio errors are contained so they cannot turn a successful save into a reported failure.

Success screens display one of four completed-session messages or two partial-session messages, selected deterministically from the session ID. The separate, initially off Encouragement voice toggle uses browser speech synthesis with the device voice. It previews on enabling, remembers the device/member preference, speaks only after a successful save, and offers explicit replay. Disabling voice, hiding the page, or unmounting cancels the app's speech. Unsupported/failed speech shows a text fallback. Voice and sound are independent preferences; this is not Kelsey's recorded voice.

## Verification

- All 28 existing portal tests, ESLint, TypeScript via production build, and local production build passed.
- Anonymous local production demo at 320×568: start, enable sounds/voice, next movement, finish/check-in, completed save, replay, mute both, reload/new session, next movement, partial save.
- Instrumented Web Audio observed preview 660 Hz, next movement 523.25/659.25 Hz, and exactly one completed celebration 523.25/659.25/783.99/1046.5 Hz. Instrumented speech observed preview and exactly one saved encouragement matching the visible message.
- Muted session produced zero tone/speech calls. Both preferences persisted. Partial session retained one completed workout from the prior completed demo save.
- No horizontal overflow at 320px; saved screen screenshot inspected. No reported browser errors. Checks used browser-local demo data, with no member/database writes.
- Speech calls were instrumented; physical speaker output, actual voice quality, iPhone/Safari autoplay, and locked-screen audio were not verified. Keep the app open; Hear encouragement provides a direct user-gesture replay.

API references: [Speech synthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/speak), [speech cancellation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/cancel).

## Deployment

Portal production deployment `dpl_BgYEZ6ihr2FN3SEcPq2tPHaBypnF` READY at https://portal.holden.health, using root `npm run deploy:portal`. Vercel build passed. Anonymous production demo opened and started successfully, with both new controls present. No runtime-log audit or physical device audio check claimed. Public website and database unchanged; no dependencies added.
