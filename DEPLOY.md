# 🚀 Deploy Voting Template to marsbase.win

---

## Prerequisites

| Requirement | Status |
|---|---|
| Node.js installed (LTS from [nodejs.org](https://nodejs.org)) | needed for Wrangler |
| marsbase.win on Cloudflare | ✅ already done |
| Pexels / any image API key | ✅ not needed — uses Openverse (free, no key) |

---

## Deploy in 3 Steps

### Step 1 — Double-click `deploy.bat`

It will:
1. Install Wrangler CLI (`npm install -g wrangler`)
2. Open your browser to log into Cloudflare
3. Deploy the app to Cloudflare Pages

Your app will be live at `https://marsbase-voting.pages.dev` immediately.

---

### Step 2 — Add Workers AI Binding (enables auto-caption feature)

> **This must be done in the Cloudflare Dashboard — there is no CLI command for this.**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Workers & Pages → marsbase-voting**
3. Go to **Settings → Bindings → Add**
4. Choose **Workers AI**
5. Set the variable name to: `AI`
6. Click **Save**
7. Redeploy to activate: `wrangler pages deploy . --project-name=marsbase-voting`

> **Why?** This powers "drop an image → AI fills the label text automatically". It uses Cloudflare's built-in AI — **completely free**, no external API needed.

---

### Step 3 — Add Custom Domain marsbase.win

1. Go to **Workers & Pages → marsbase-voting**
2. Click **Settings → Domains & Routes → Add Custom Domain**
3. Type: `marsbase.win`
4. Click **Continue**
5. Cloudflare auto-creates the DNS records (since marsbase.win is already on Cloudflare)
6. Wait ~60 seconds for TLS certificate provisioning

**Your app is now live at https://marsbase.win 🎉**

---

## Updating the App Later

Any time you edit files locally, just run:
```bash
wrangler pages deploy . --project-name=marsbase-voting
```

---

## Local Development

```bash
# Start local dev server with Workers AI simulation
wrangler pages dev .
```
Open http://localhost:8788

---

## How Image Search Works (No API Key Needed)

The app uses two completely free, key-free image sources:

| Source | What it is | Fallback? |
|---|---|---|
| **Openverse** | WordPress/Automattic's Creative Commons image search | Primary |
| **Wikimedia Commons** | Wikipedia's free media library | Fallback |

Type a label in any slot and press **Enter** — the Worker searches Openverse, falls back to Wikimedia if needed.

---

## Project Structure

```
marsbase-voting/
├── index.html                 ← App UI (HTML)
├── style.css                  ← Dark Mars/space theme
├── app.js                     ← Drag/drop, search, canvas export
├── wrangler.toml              ← Cloudflare Pages config
├── deploy.bat                 ← Windows one-click deploy
├── DEPLOY.md                  ← This file
└── functions/
    ├── _middleware.js         ← CORS headers (all routes)
    └── api/
        ├── search.js          ← GET /api/search?q=... (Openverse + Wikimedia, free)
        ├── caption.js         ← POST /api/caption (Cloudflare Workers AI, free)
        └── proxy.js           ← GET /api/proxy?url=... (image CORS proxy)
```
