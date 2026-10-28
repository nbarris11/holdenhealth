# Weekly launch SEO review — September 18, 2026

First follow-up for automation `holden-health-launch-seo-follow-up`. Next reviews remain scheduled through October 9. No production changes or indexing submissions made.

## Search Console evidence

Signed-in canonical URL-prefix property: https://www.holden.health/.

- Sitemap: Success; submitted September 11; last read September 16; type now Sitemap; 22 discovered pages. This resolves the launch baseline's stale December 2025 read and zero discovered pages.
- Page indexing report: 11 indexed, 16 not indexed; report last update September 13. These are all known URLs, including legacy URLs, not just the 22 sitemap URLs.
- Indexed examples explicitly include all five priority submissions: homepage, coaching.html, personal-training.html, fitness-coaching.html, about.html; each displays September 11 last crawl. Also includes nutrition-coaching.html and 20-minute-strength-workout.html plus legacy URLs.
- Remaining reasons: 14 discovered/currently not indexed, 1 crawled/currently not indexed, 1 redirect. No noindex exclusion listed. The old September 5 homepage noindex result was historical; homepage now appears in indexed examples.
- Performance: seven-day filter selected; displayed chart covers September 10–15, 2026 (data lag). 18 clicks, 53 impressions, 34% CTR, average position 7.3. This window includes prelaunch September 10 and is not a clean postlaunch attribution window. Visible queries include holden health (6 clicks/16 impressions), kelsey holden (0/3), holden homepage (0/1), holden medical (0/1). Query rows do not account for all totals; do not infer nonbrand ranking gains from aggregate position or hidden queries.

## Live HTTP checks

All 22 sitemap URLs return 200 directly, with matching canonical URLs and no robots-meta or X-Robots-Tag noindex. robots.txt allows crawling and points to the canonical sitemap. Homepage verification tag remains present. Both retired routes (/preview.html and /preview-access) return one-hop 308 to canonical homepage on both hostnames.

Raw evidence: ../.seo-cache/follow-up-2026-09-18.json.

## Assessment

Meaningful progress: all five priority pages indexed and sitemap freshly processed. No live crawl regression or required user action found. Remaining exclusions will be compared next week; no repeat indexing requests needed. Legacy indexed examples were observed but their individual redirect behavior was not audited in this review.
