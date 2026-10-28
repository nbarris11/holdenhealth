# Challenge page wording — September 11, 2026

User requested editing “A little support at home” and other wording on the free 21-day page.

Added a shared field registry and a grouped “Challenge page wording” editor in Challenges. Includes support heading and both paragraphs, intro, note heading, sign-in/join labels and instructions, custom habit example, participant-preview headings and promotional copy, and the between-challenges message. Content → Edit website now has a prominent Free 21-Day Challenge editor link. The live support box also links admins to the editor.

Save page wording publishes to the existing `site_content` table using `challenge:page`. This wording is shared by all free challenges; the UI explicitly explains that scope. Existing challenge-specific name, dates, note body, habit options, and workout editors remain intact. Existing wording is the fallback until changes are saved. No migration, new dependency, content publication, member-data change, or signup-rule change. App-generated counts, status/error messages, authentication controls, privacy notices, and functional destinations remain controlled by the app.

Validation checks every registered text field server-side. React renders text without raw HTML, and paragraph line breaks are preserved. The controlled edit form retains entered text when validation or storage fails. An admin content-read failure prevents editing fallback values over saved content. Public reads only use published content.

Verification:
- Production build / TypeScript and ESLint passed.
- Existing full suite plus two new copy normalization/validation tests passed (40 tests). Two additional save-action tests subsequently passed, covering authorization, publication, revalidation, invalid input and storage failure; four focused tests total.
- Real database transactional checks verified existing admin insert/update and public read policies; non-admin insert denied. Rolled back; zero test rows retained.
- React review checked controlled input retention, labels, server-action authorization, and ordinary escaped rendering.
- No authenticated browser save, visual browser check, customer sign-in email, or physical phone test performed.

Deployment: required root `npm run deploy:portal` completed; `dpl_FDm7iXthug7NgHkPkHG6sjFNqbox` READY at https://portal.holden.health. Live challenge HTTP 200, new renderer marker and existing support/signup text verified; admin edit links hidden publicly and editor redirects anonymous users to admin login. All 39 configured fields are connected to the page/form renderer. Public website unchanged.
