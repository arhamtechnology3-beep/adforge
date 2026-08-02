# Facebook Meta Ads

AI-powered ad generation and campaign automation platform for D2C Shopify sellers in India, focused on Facebook & Instagram (Meta) ads.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL via Supabase (auth + DB)
- **Billing:** Razorpay Subscriptions
- **Queue:** BullMQ + Redis
- **AI:** OpenAI GPT-4o-mini + DALL-E 3

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_initial_schema.sql` via the SQL Editor
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
- `POST /api/webhooks/razorpay` — Billing webhook

## License

Private — All rights reserved.
