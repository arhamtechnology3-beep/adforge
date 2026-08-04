# Facebook Meta Ads

AI-powered ad generation and campaign automation platform for D2C Shopify sellers in India, focused on Facebook & Instagram (Meta) ads.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL via Supabase (auth + DB)
- **Billing:** Razorpay Subscriptions
- **Queue:** BullMQ + Redis
- **AI:** Free brand-aware copy + Meta-compliant creative renderer (`/api/ads/creative`). Optional OpenAI / Groq.

## Product vision — replace the digital marketing + creative team

This platform is built to cover the full Meta ads lifecycle that agencies usually staff with multiple people:

| Team role today | What our system does |
|-----------------|----------------------|
| Strategist | Onboarding: brand URL + competitor URLs, angle planning |
| Copywriter | 10 Meta primary-text variants (offer, UGC, urgency, etc.) |
| Creative designer | Multi-format creatives: Feed 1:1, Carousel, Stories 9:16, Video slideshow |
| Media buyer | Draft campaign → Ad set → Ads via Marketing API, manual Confirm & Launch |
| Analyst | Insights sync, spend/CPC/CPA charts, WhatsApp reports |
| Optimizer | Auto-pause when CPA exceeds target for 3+ days |

### Roadmap (phased)

**Phase A — live now**
- Auth, billing scaffold, onboarding, Meta-ready creative review, launch confirm flow, performance + workers scaffold

**Phase B — creative studio**
- Image / Carousel / Stories / Video format options at review (client picks winners → launch)
- Multi-product image scrape from Shopify
- (Next) A/B creative sets + brand kit + real MP4 export
- Ad Library competitor insight assist

**Phase C — full media buying**
- Audience suggestions (India interests / lookalikes)
- Budget pacing + bid strategy presets
- Creative fatigue detection + auto refresh variants

**Phase D — reporting & optimization**
- Weekly client-ready PDF/WhatsApp decks
- Rule engine (scale winners / kill losers)
- ROAS goals per SKU

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations in `supabase/migrations/` via the SQL Editor (001 → 006)
3. Enable Phone Auth in Supabase Dashboard → Authentication → Providers → Phone
4. Copy your project URL and keys to `.env.local`

### 3. Configure environment

```bash
cp .env.example .env.local
# Fill in all required values
```

### 4. Start Redis (for background jobs)

```bash
docker run -d -p 6379:6379 redis:alpine
```

### 5. Run the app

```bash
npm run dev
```

### 6. Start background workers (separate terminal)

```bash
npm run worker
```

## Manual Prerequisites

### Meta OAuth (Task 5)

Before connecting Meta ad accounts, you need:

1. A [Meta Developer App](https://developers.facebook.com/) with Marketing API access
2. Set `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` in `.env.local`
3. Add the redirect URI to your Meta App's OAuth settings

### Email reports (Ops Agent)

Digests and policy alerts are **email-only** (no WhatsApp reporting).

1. Set `RESEND_API_KEY` + `EMAIL_FROM`, or leave empty for console stubs
2. Users need `email` + `email_reports_opt_in` (default true after migration 006)
3. Run `npm run worker` for morning/midday/afternoon/evening Ops slots + digests

### Meta Policy Guard

Versioned norms pack (`META_POLICY_PACK_VERSION` / `meta_policy_rules`). Critical/high matches auto-pause offending ads and email the founder. Bump pack version when Meta policies change, then re-scan on next morning slot.

### Reports Hub

In-app library at `/reports` — executive, daily/weekly/monthly, creative, audience, funnel, policy audit, and strategy packs. Uses dry-run sample data until Meta Insights sync.

### Razorpay Plans

Create 3 subscription plans in the Razorpay Dashboard and set the plan IDs in env vars.

## Features

| Task | Feature | Status |
|------|---------|--------|
| 1 | Database schema with RLS | ✅ |
| 2 | Email + Phone OTP auth | ✅ |
| 3 | Razorpay billing + webhook | ✅ |
| 4 | Multi-step onboarding | ✅ |
| 5 | Meta OAuth connection | ✅ (requires env vars) |
| 6 | AI ad generation + review UI | ✅ |
| 7 | Campaign launch (manual confirm) | ✅ |
| 8 | Performance dashboard | ✅ |
| 9 | BullMQ automated jobs | ✅ |
| 10 | Dashboard layout & design | ✅ |
| 11 | Ops Agent + Policy Guard | ✅ (email alerts; dry-run without Meta) |
| 12 | Reports Hub (DM library) | ✅ |
| 13 | Email digests (no WA reports) | ✅ |

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, Signup
│   ├── (dashboard)/     # Protected pages
│   └── api/             # API routes
├── components/          # UI components
├── lib/                 # Utilities (supabase, meta, ai, razorpay)
├── types/               # TypeScript types
└── workers/             # BullMQ jobs
supabase/
└── migrations/          # SQL schema
```

## API Routes

- `POST /api/onboarding` — Save campaign inputs
- `POST /api/ads/generate` — Generate 10 AI ad variants
- `PATCH /api/ads/[id]` — Approve/reject/edit ads
- `POST /api/campaigns/launch` — Create draft Meta campaign
- `POST /api/campaigns/[id]/confirm` — Confirm & launch campaign
- `GET /api/performance/[campaignId]` — Campaign metrics
- `GET /api/oauth/meta/connect` — Meta OAuth redirect
- `GET /api/reports` — Reports Hub catalog + view builders
- `GET /api/ops/recommendations` — Ops Agent inbox
- `POST /api/ops/recommendations/[id]/confirm` — Approve / reject actions
- `POST /api/webhooks/razorpay` — Billing webhook

## License

Private — All rights reserved.
