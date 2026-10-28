# Website editor simplification plan

Date: October 27, 2026
Status: Proposed plan; no redesign implementation or deployment in this planning pass.

## Goal

Kelsey can **Edit → Preview → Publish** without needing to know where website content is stored. Edits remain private until she explicitly publishes. Preview shows the complete proposed page; Publish pushes the reviewed changes to the public site.

## What we found

Code review and an authenticated Chrome walkthrough of Content → Edit your website confirm that the editor has accumulated several separate workflows:

- Ordinary text opens controls beside the preview. Clicking the Home headline successfully selected its actual words.
- A featured promotion opens a separate dialog with its own publish button. The current Home promotion dialog opens and matches the displayed headline.
- Clicking the header expands a separate form above the editor, with another publish button.
- Promotion settings, challenge editing, drop-in settings, and a long page-management list come before the visual editor. A second page picker repeats the page list.
- The page publisher says only that page will publish, while the promotion affects Home and Coaching and the header affects every public page.
- Page text, saved visual overrides, older promotion copy, and program-generated details have different sources. Generic defaults previously caused fields to disagree with the preview.
- Home currently displays October session material alongside the December promotion. October is still an active program, so this is not automatically wrong; the editor needs to distinguish current-session content from the featured upcoming program.

This pass inspected selection and navigation without publishing or changing saved content. It does not establish that publication, failure recovery, or mobile editing works end to end. Earlier click fixes remain useful, but do not resolve the fragmented workflow.

## Recommended experience

### 1. Edit

Open directly into the selected page with a compact page picker, large page canvas, and one editing panel. Keep the current page and scroll position when selecting an item.

- Clicking text, a photo, a button, the header, or a promotion opens the same panel with relevant controls.
- Show the exact displayed words and image, including existing customizations.
- Start with words, photo, button label, and destination. Put typography and other infrequent controls under More options.
- Highlight editable items on hover and selection. Support keyboard selection and a section list as an alternative to clicking the canvas.
- Clearly identify content scope: **This page**, **Home and Coaching**, or **All pages**.
- Show program dates, prices, and class times as program-managed details with a direct link to the correct program controls. Website publication must not silently change registration terms or schedules.
- Move page creation, ordering, search appearance, and site settings into a secondary Manage pages / Settings area.
- Keep the challenge page clearly identified as a separate portal editor in the first release.

### 2. Preview

A prominent **Preview changes** button opens a clean view without editing outlines or controls. Offer desktop and phone widths and an obvious **Back to editing** action.

- Render the complete saved draft, including pending page text, images, header, and promotion changes together.
- Use the same content resolution and rendering rules as the public website.
- Make the preview private to the authorized editor; public visitors continue seeing published content.
- Label it **Unpublished preview** and show which pages are affected by shared changes.
- Preserve all edits when moving between Edit and Preview. Any later edit invalidates the previous review and requires another preview before publishing.
- Allow inspection of menus and accordions without accidentally submitting public forms or booking a program.

### 3. Publish

Preview includes a clear **Publish changes** button and a short summary of affected pages. There should be one publication flow for website changes.

- Publish the exact draft revision Kelsey previewed.
- Include pending changes for the selected page and the explicitly listed shared header/promotion changes. Drafts on unrelated pages remain private.
- Validate the complete publication before writing. Commit the related website records together so a failure cannot publish only part of the reviewed change.
- Disable duplicate submission and retain the draft on failure with a useful explanation.
- Detect another editor's newer publication rather than silently overwriting it.
- Confirm **Published**, show the time, and provide **View live page**. Check the public content revision and refresh relevant caches so success corresponds to the updated site.
- Keep a recoverable previous published version for rollback.

## Drafts and content reliability

Use a private persisted draft separate from published website content. Clearly distinguish **Saving draft**, **Draft saved**, **Unsaved changes**, and **Published**. Recover drafts after refresh and preserve them when a save fails. Offer an explicit discard action with a clear scope.

Build a shared content resolver so field values, draft previews, and public pages agree. Give frequently edited content stable identifiers. Continue reading existing selector-based overrides and preserve existing custom sections; migrate incrementally with before/after comparisons.

Do not silently replace the different legacy Home and Coaching promotion wording with a shared default. Preserve it until an explicit reviewed change chooses shared wording. Audit repeated dates, prices, and schedule text and map each to its intended program or editorial purpose before making it automatic.

## Delivery sequence

1. **Map and prototype.** Inventory common editable items and their source, scope, and publish behavior. Create the proposed editor layout using Home and Coaching. Walk through headline, photo, button, promotion, and header tasks before expanding it.
2. **Unify drafts and preview.** Add private drafts, revision checks, shared content resolution, and a composed desktop/phone preview. Preserve existing published output and older overrides.
3. **Unify editing and publishing.** Move existing controls into the contextual panel; add the reviewed publication flow, atomic writes, recovery, and public readback. Remove competing publish controls from the new experience.
4. **Verify and roll out.** Test with disposable staging content, then have Kelsey complete the core tasks. Release the coherent workflow after those checks; retain a rollback path during rollout.

Keep the existing public site, portal, authentication, and content storage where practical. No new CMS or drag-and-drop page-builder dependency is needed. A single publish button requires coordinated draft and save behavior underneath; moving buttons alone is insufficient.

## Acceptance checks

- Content → Edit your website opens the useful editor immediately, without scrolling through settings.
- Kelsey can change a headline, button label/link, photo, and promotion without leaving the consistent editing panel.
- Existing words in every field match the displayed page, including legacy Home/Coaching promotion differences.
- Desktop and phone previews show all pending edits, including shared header and promotion changes.
- Public visitors see no changes before Publish.
- Back to editing and page switching preserve drafts; refresh recovers the saved draft.
- Publish affects only the reviewed page/shared changes; unrelated page drafts remain private.
- Failed validation, network failure, duplicate clicks, and concurrent edits do not lose work or cause partial publication.
- Program dates/prices lead to the correct operational editor; website copy edits do not alter registrations.
- Live readback matches the reviewed revision after publishing; previous content can be restored.
- Existing custom sections, menu behavior, images, links, and search metadata remain intact.
- Verify at Kelsey's laptop size, a narrow phone width, and with keyboard navigation. Have Kelsey complete the flow without coaching before considering it finished.

## Implementation areas

- `web-app/src/app/admin/website/page.tsx` and `editor.tsx`: editor layout, selection, draft/review states.
- `featured-program-form.tsx`, `header-editor.tsx`, and their actions: consistent contextual controls and publication behavior.
- `web-app/src/lib/website-pages.ts`, `web-app/src/app/api/site-content/route.ts`, and `site.js`: matching content resolution, preview transport, stable item identity.
- Website publishing actions and database layer: private drafts, revision checks, coordinated publication, version recovery.
- Browser regression harness and targeted integration checks: full Edit → Preview → Publish flow and failure cases.

Deployment remains through the two existing root scripts, `npm run deploy:site` and `npm run deploy:portal`, with their current Vercel Root Directory settings.
