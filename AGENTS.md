# Holden Health project instructions

## Project memory

Before continuing work, read [the September 9, 2026 handoff](docs/project-memory-2026-09-09.md) and its linked records for the shipped progress-story feature, deployments, retained demo members, verification limits, and the user's stopping point. Treat these as dated history and inspect current state before making changes.

## Deployment

This workspace contains two separate Vercel projects:

- Public website: `holdenhealth` at the repository root
- Secure portal: `holdenhealth-portal` in `web-app`

Always deploy from `/Users/barris/Desktop/holden-health-site` using these commands:

```bash
npm run deploy:site
npm run deploy:portal
```

Never run `vercel --prod` from inside `web-app`. The portal project already has `web-app` configured as its Vercel Root Directory, which otherwise causes Vercel to look for `web-app/web-app`.

Do not change either Vercel project's Root Directory unless the user explicitly requests a deployment architecture change.
