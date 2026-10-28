# Holden Health: launch SEO

Updated September 11, 2026. The public website is live. The preview gate and environment-dependent launch switch have been removed. Public robots.txt allows crawling; all 20 sitemap pages are accessible without cookies.

## Completed in the site

- Compact HTML navigation with crawlable links to Group Classes, Online Training, About, Resources, and the homepage app section. Contact remains in the footer.
- App introduction with a free-challenge entry point and member login. It accurately describes browser access, rather than an App Store download.
- All 20 sitemap pages checked for unique titles/descriptions, matching canonical URLs, one H1, valid JSON-LD, image alt attributes, and existing local links.
- Vercel redirects for the canonical www hostname, index.html, and known former Wix URLs. The old redirects were only in Netlify configuration.
- Unsupported priceRange removed from Organization schema. Existing service, author, article, and business data retained.
- Sitemap updated for changed pages. No private account, test, or legal pages added to it.
- Retired preview URLs redirect home; template-only URLs carry noindex protection. Public deployment excludes portal source, database migrations, internal notes, test files, and local environment files.
- Preview gate and launch switch retired September 11; old preview links redirect permanently home.

## On announcement day

1. Launch is complete. PUBLIC_SITE_LIVE and PREVIEW_PASSWORD no longer control public access; do not follow the former environment-switch procedure.
2. Deploy the public site from the repository root with `npm run deploy:site`.
3. Check in a signed-out browser: homepage and main service pages load without a password; robots.txt contains Allow: / and the sitemap URL; sitemap.xml returns XML; normal pages have no noindex header. Confirm an unknown URL returns HTTP 404.
4. Verify that https://holden.health/ redirects to https://www.holden.health/ and that old Wix URLs resolve to the correct pages.
5. Verify a **Domain property for holden.health** in Google Search Console. Submit https://www.holden.health/sitemap.xml and inspect the homepage, coaching.html, fitness-coaching.html, and about.html. Request indexing after they are public.
6. Check Google's Rich Results Test and PageSpeed Insights on the now-public homepage and key service pages. Live speed scores and Google's indexing have not been measured while behind the preview gate; passing source checks does not establish either.
7. Confirm final dates, prices, signup availability, coaching credentials, and contact details with Kelsey. The published offers have changed since the old launch checklist; do not use its former monthly prices.

## Local discovery and announcement

- Claim/verify the real Holden Health Google Business Profile. Use an eligible customer-facing location or a service area as appropriate; never add a made-up address.
- Keep the business name, contact details, service area, and website consistent across Google, Facebook, Instagram, and partner profiles.
- Submit the same sitemap in Bing Webmaster Tools.
- Link announcement posts to the relevant offer or free challenge, rather than only to login.
- Ask actual clients for honest reviews, with no review gating or invented testimonials.

## After launch

Review Search Console indexing, queries, clicks, and page experience after the first few weeks. Use actual client questions to guide useful articles linked to the relevant coaching service. Google needs crawlable pages, useful content, and time; no ranking position is guaranteed.

Custom pages created in the visual editor are currently rendered from a shared client-side template. Before treating one as an SEO landing page, give it reliable page-specific HTML metadata and add its canonical URL to the sitemap. Existing 20 static sitemap pages have their metadata in HTML already.

## Repeatable source checks

```bash
cd /Users/barris/Desktop/holden-health-site
npm run check:site
```

References: [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [robots.txt guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro).

## September 11 execution

Verified the canonical URL-prefix property in Search Console via homepage meta tag and submitted the sitemap. Domain-wide DNS verification remains optional and unfinished. Preserve the verification tag. See [execution record](docs/seo-launch-2026-09-11.md) for indexing request outcomes and live Google test baselines.
