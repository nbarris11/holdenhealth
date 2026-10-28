# SEO launch follow-through — September 11, 2026

## Shipped

Public website deployment dpl_7Wz7MiFkfDwwhN4RFxdZBQA3bmL1 READY, deployed with root npm run deploy:site. Retired preview GET/HEAD URLs now return 308 directly to canonical homepage on both hostnames. Old POST form submissions retain 303 to avoid forwarding the POST. Added Google verification meta tag to index.html; preserve it. Nine website tests and 20-page source SEO checks pass. Portal unchanged.

## Search Console

Verified URL-prefix property https://www.holden.health/ in the signed-in Neil Barris account with HTML tag. Domain property holden.health was added but remains unverified; DNS is at GoDaddy and was not modified. URL-prefix property covers all canonical public pages and is sufficient for current sitemap/indexing work.

Submitted sitemap.xml successfully September 11. Initial table still showed historical last-read December 29, 2025, old Sitemap index type and zero discovered pages; submission success does not mean current sitemap processed. Homepage inspection showed historical noindex from September 5 crawl. Current live homepage has no noindex. Homepage indexing request accepted into priority crawl queue.

## Google mobile lab baselines

No real-user field data available. Scores are lab samples, not ranking predictions or full Core Web Vitals assessments.

| Page | Performance | Accessibility | Best practices | SEO | LCP |
| --- | --- | --- | --- | --- | --- |
| Home | 82 | 92 | 100 | 100 | 3.8s |
| Group classes | 100 | 98 | 100 | 100 | 1.5s |
| Personal training | 94 | 100 | 100 | 100 | 2.4s |
| Online training | 94 | 95 | 100 | 100 | 2.4s |

Reports:
- https://pagespeed.web.dev/analysis/https-www-holden-health/wis2piknn1?form_factor=mobile
- https://pagespeed.web.dev/analysis/https-www-holden-health-coaching-html/uj4qbkxf0b?form_factor=mobile
- https://pagespeed.web.dev/analysis/https-www-holden-health-personal-training-html/p38tiz7ajo?form_factor=mobile
- https://pagespeed.web.dev/analysis/https-www-holden-health-fitness-coaching-html/1jlsga9x8a?form_factor=mobile

Homepage follow-up opportunities: render-blocking requests, image delivery, contrast, heading order, main landmark. No performance/UI redesign performed.

Rich Results: homepage 1 valid Organization; group classes 2 valid items (Breadcrumbs and Course), optional Course provider name missing; personal training crawled successfully with no rich-result items, which is not an indexing block. JSON syntax checks pass across all sitemap pages; these do not prove rich-result eligibility.

## Monitoring

Created thread heartbeat holden-health-launch-seo-follow-up for four weekly Friday 10am checks. Notify only meaningful progress, regression, required action or final summary; end after final review by October 9. Google processing and rankings are not immediate.

Online-training Rich Results Test: 1 valid BreadcrumbList; successful crawl. https://search.google.com/test/rich-results/result?id=7D54m8EQGWwFunxcf0w9pg

Post-deployment live HTTP checks: all 20 sitemap pages return 200 without meta/header noindex; homepage verification tag present; preview routes on both hostnames return one-hop 308 home.

## Final indexing submissions

Google explicitly confirmed “Indexing requested” and priority crawl queue acceptance for all five:
- https://www.holden.health/
- https://www.holden.health/coaching.html
- https://www.holden.health/personal-training.html
- https://www.holden.health/fitness-coaching.html
- https://www.holden.health/about.html

About initially returned a Google submission error; one retry succeeded. Do not repeat these submissions during monitoring. Four service/About URLs were unknown to Google before submission; homepage had the historical September 5 noindex exclusion. None of these confirmations establish actual indexing or rankings.

Remaining recommendations: optional domain-wide DNS verification at GoDaddy, homepage performance/accessibility improvements, optional provider-name schema completion on group-class page. No need for DNS verification to use the already-verified canonical public-site property. No authenticated portal crawl, runtime log audit, desktop speed report, or physical-device testing was performed.
