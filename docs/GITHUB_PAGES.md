# GitHub Pages (free site, no custom domain)

Marketing site URL (after you enable Pages):

**https://stikerislt.github.io/launchdoctor/**

## Enable once

1. Open https://github.com/stikerislt/launchdoctor/settings/pages
2. **Build and deployment** → Source: **Deploy from a branch**
3. Branch: **main** · Folder: **/docs**
4. Save. Wait 1–2 minutes for the site to go live.

## What this is / isn’t

| GitHub Pages | Your Shopify app |
|--------------|------------------|
| Static landing page (this `docs/` folder) | Remix server + Postgres + Redis + worker |
| Free `*.github.io` URL | Needs Fly.io / Render / etc. |
| Good for README links, pitch deck | `application_url` in Partner Dashboard |

You can run the app on **Fly.io** with a free subdomain like `https://launch-doctor.fly.dev` — no domain purchase required.
