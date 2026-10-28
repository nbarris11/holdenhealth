# FAQ editor selection — September 11, 2026

The coaching FAQ experience answer could not be selected because the visual editor deliberately rejects non-leaf text elements; this paragraph contains a guide link. The coach-credentials answer had the same structure.

Added three stable-ID spans around the plain-text portions of those two answers in `coaching.html`. Wording, spacing, links, paragraph order, and existing link selectors remain unchanged. Each text portion can now be selected independently with the existing editor. No shared editor, portal, database, or saved content changes.

Checks: `npm run check:site` passed (20-page SEO validation and 11 tests). In-app browser verified actual clicks highlight the introductory text, trailing text, guide link, and coach credentials. An isolated local iframe using the actual `site.js` verified a preview text override by stable ID, retained guide link, and reset restoring the original text. The test harness was removed before deployment. No live content publication or authenticated editor save was submitted. Existing unpublished user drafts must be saved before refreshing.

The initial targeted fix deployed successfully as `dpl_4qSvC7Rmci2yHqGZvM1vYpi33U5r` (READY). The user then explicitly requested a site-wide editor solution and production deployment; see [universal editor release](website-editor-release-2026-09-11.md).
