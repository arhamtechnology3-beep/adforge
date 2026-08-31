# AdForge — Change Log

Living log of product and engineering changes. **Update this file on every meaningful change** (features, fixes, migrations, env, UX).

Format: newest entries first. Date is local project context (IST).

---

## 2026-08-31

### Switch creative engine: OpenRouter + Cloudflare (remove Gemini)
Replaced paid Gemini/Veo with OpenRouter FLUX (primary) and Cloudflare Workers AI (free fallback).

**What changed**
- `generateOpenRouterImage()` — OpenRouter Image API with product `input_references`
- `generateCloudflareImage()` — FLUX Schnell via Workers AI
- Removed `gemini-creative.ts` and all `GEMINI_*` env vars
- Video ads use slideshow frames again (no paid video API)

**Env vars** (`.env.local`)
- `OPENROUTER_API_KEY` — primary image generation
- `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — free fallback

**Files**
- `src/lib/openrouter-creative.ts`, `src/lib/cloudflare-creative.ts`
- `src/lib/creative-providers.ts`, `src/lib/replicate-ads.ts`

---

## 2026-08-31

### Gemini API integration — Nano Banana images + Veo video
Wired Google Gemini for agency-grade creatives: native image generation with product reference, Veo for real video ads.

**What changed**
- `GEMINI_API_KEY` in `.env.local` — image via `gemini-2.5-flash-image`, video via `veo-3.1-fast-generate-preview`
- `generateGeminiImage()` / `generateGeminiVideo()` — saves to `public/uploads/gemini/`
- Replicate flow uses Gemini output directly (skips Satori overlay when Gemini succeeds)
- Video ads play real `.mp4` when Veo succeeds

**Manual steps**
- Add `GEMINI_API_KEY` to `.env.local` (from Google AI Studio)
- Enable billing on the GCP project for Veo (paid tier only)
- Restart dev server after env change
- Regenerate ads — first run may take 30–90s per image

**Files**
- `src/lib/gemini-creative.ts`, `src/lib/creative-providers.ts`, `src/lib/replicate-ads.ts`

---

## 2026-08-31

### Creative engine: competitor-informed briefs + pluggable image providers
Agency-quality upgrade path — briefs derived from selected competitor ads; scene generation via Photoroom / Fal / OpenAI when keys are set.

**What changed**
- `buildCreativeBrief()` — mood, layout, counter-hook, scene prompts from competitor ad copy
- `generateSceneImage()` — provider chain: Photoroom → Fal FLUX → DALL·E → Pollinations fallback
- Replicate flow now async; stores `creative_brief` on each ad

**API keys to add** (`.env.local`): `PHOTOROOM_API_KEY` (recommended), `FAL_KEY`, optional `CREATOMATE_API_KEY` for video

**Files**
- `src/lib/creative-brief.ts`, `src/lib/creative-providers.ts`, `src/lib/replicate-ads.ts`

---

## 2026-08-31

### Fix: local dev broken + creative previews failing
Corrupted `.next` cache caused JS chunk 404s; generated creatives pointed at `localhost:3010` instead of `:3000`.

**What changed**
- Creative URLs now use relative paths (`/api/ads/creative?...`) — works on any port
- `normalizeCreativeUrl()` fixes already-saved demo ads with wrong port on load
- `resolveAppOrigin()` helper; default port 3010 → 3000
- Restart dev with `rm -rf .next && npm run dev` when chunks 404

**Manual steps**
- If page is blank/broken: stop dev server → `rm -rf .next` → `npm run dev`
- Hard refresh `/ads` (Cmd+Shift+R) then click **Regenerate from selection**

**Files**
- `src/lib/app-url.ts`, `src/lib/creatives.ts`
- `src/app/api/ads/generate/route.ts`, `src/app/(dashboard)/ads/page.tsx`

---

## 2026-08-31

### Fix: competitor ads not visible on /ads (demo + empty state)
Ads page showed blank Step 1 because APIs required Supabase auth and demo onboarding had no default competitors.

**What changed**
- `resolveCampaignInput()` — shared demo/real campaign input resolver
- Default demo onboarding seeds FarmDidi competitor + Page ID when onboarding not completed
- `GET /api/ads/generate` and `POST /api/competitors/meta-library` work in demo mode
- Demo generated ads stored in `demo_generated_ads` cookie; PATCH/DELETE supported
- `/ads` auto-fetches live Ad Library on load; empty state + loading spinner when no competitors

**Manual steps**
- Refresh `/ads` after demo login — competitor ads should load within ~10–30s (Playwright fetch)
- If Step 1 is still empty: `npx playwright install chromium` (also runs on `npm install` via postinstall)
- Or complete onboarding with your own competitor URLs

**Files**
- `src/lib/auth/campaign-input.ts`, `src/lib/auth/demo-ads.ts`
- `src/app/api/ads/generate/route.ts`, `src/app/api/competitors/meta-library/route.ts`, `src/app/api/ads/[id]/route.ts`
- `src/app/(dashboard)/ads/page.tsx`

---

## 2026-08-31

### Sale-ready polish: onboarding, templates, unified flow, trial gate
Completed the remaining UX unification and sale-readiness features.

**What changed**
- **Onboarding** — Meta blue design, `WizardStepper`, clearer copy, safety note on PAUSED campaigns
- **Campaign templates** — Festive Sale, New Launch, Store Traffic, Retargeting, Engagement (auto-fill wizard fields)
- **Unified flow** — `/ads` Step 3 removed; "Launch campaign" redirects to `/campaigns?from=ads` with competitor strategy prefill via `sessionStorage`
- **Trial gate** — `TrialGate` overlay blocks ads/campaigns after trial expires; API returns 402 on generate/launch
- **Dashboard** — Contextual next-step CTAs (onboarding → ads → campaigns)
- **Demo session** — validate/launch APIs work with demo cookie

**Manual steps**
- Test flow: onboarding → ads (approve) → Launch campaign → pick template → review checklist → create on Meta

**Files**
- `src/lib/campaign-templates.ts`, `src/lib/campaign-prefill.ts`, `src/lib/trial-gate.ts`
- `src/components/TrialGate.tsx`, `src/components/DashboardShell.tsx`
- `src/app/(dashboard)/onboarding/OnboardingClient.tsx`, `src/app/(dashboard)/ads/page.tsx`
- `src/components/campaign-wizard/CampaignWizard.tsx`

---

## 2026-08-31

### Campaign wizard UX + Meta field wiring + pre-launch validation
Replaced the basic campaigns form with a **6-step Meta-style wizard** (Goal → Audience → Budget → Creatives → Review → Launch), Facebook Feed/Stories/Reels live preview, and a pre-launch checklist that blocks invalid payloads before they hit Meta.

**What changed**
- Meta blue design system (`#1877F2`) in `globals.css` + sidebar gradient
- New `CampaignWizard` with sticky stepper, placement toggles, city/interest fields, daily/lifetime budget, schedule
- `FacebookAdPreview` — phone mockup with Feed / Stories / Reels tabs + character counters
- `ValidationChecklist` — green/amber/red pre-flight checks on Review step
- `src/lib/meta-campaign.ts` — objective → optimization_goal mapping (Traffic/Sales/Awareness/Engagement)
- `src/lib/meta-targeting.ts` — city/interest resolution + placement spec builder
- `src/lib/campaign-validation.ts` — validates name, budget, URL, CTA, age, headline ≤40, copy ≤2200
- `POST /api/campaigns/validate` — live validation endpoint (demo-session aware)
- Enhanced `createAdSet()` — placements, interests, cities, schedule, lifetime budget, pixel for Sales
- `npm run test:e2e` — 17 automated tests for validation + Meta field mapping

**Manual steps**
- Run `npm run dev` → `/campaigns` for the new wizard
- Run `npm run test:e2e` to verify validation logic
- Set `META_PAGE_ID`, `META_PIXEL_ID` in `.env.local` for live Meta launches

**Files**
- `src/components/campaign-wizard/*`, `src/components/ad-preview/FacebookAdPreview.tsx`
- `src/app/(dashboard)/campaigns/page.tsx`
- `src/lib/meta.ts`, `src/lib/meta-campaign.ts`, `src/lib/meta-targeting.ts`, `src/lib/campaign-validation.ts`
- `src/app/api/campaigns/validate/route.ts`, `scripts/e2e-campaign.test.ts`

---

## 2026-08-14

### Login “Failed to fetch” — Supabase DNS + local demo fallback
Email sign-in showed **Failed to fetch** because `NEXT_PUBLIC_SUPABASE_URL` (`*.supabase.co`) returns **NXDOMAIN** — the project host no longer exists, so the browser cannot reach Auth.

**What changed**
- Login/signup map network errors instead of showing the raw `Failed to fetch` string
- When Supabase is unreachable, sign-in automatically starts a local demo session and opens `/dashboard`
- Demo API is disabled in production (`NODE_ENV === 'production'`)
- Middleware skips `getUser()` when a demo cookie is set, and times out live Auth after 3s

**Manual steps**
- Refresh `/login` and click **Sign In** (or **Continue in Demo Mode**)
- To restore real auth: recreate/unpause the Supabase project and update `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`, then restart `npm run dev`

**Files**
- `src/lib/auth/demo.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`
- `src/app/api/auth/demo/route.ts`, `src/lib/supabase/middleware.ts`

### Onboarding Unauthorized in demo session
Demo login could open the dashboard, but `GET/POST /api/onboarding` still called `supabase.auth.getUser()` and returned **401 Unauthorized** (Supabase host is NXDOMAIN). Continue on Step 1 failed.

**What changed**
- Shared `getSessionUser()` treats the `demo_session` cookie as an authenticated user
- Demo onboarding is saved in an httpOnly `demo_onboarding` cookie (no live DB)
- Step 3 shows **Continue without Meta (local preview)** in demo mode

**Manual steps**
- Refresh `/onboarding` and click **Continue** again with the website URL

**Files**
- `src/lib/auth/session.ts`, `src/lib/auth/demo-onboarding.ts`
- `src/app/api/onboarding/route.ts`, `src/app/(dashboard)/onboarding/OnboardingClient.tsx`

---

## 2026-08-04

### Step 2/3 polish — brand scrub, media upload, strategy mirror
Client feedback from `/ads` screenshots: competitor names (FarmDidi) leaked into replicated copy; manual/edit lacked media upload; Step 2 had no float to Step 3; Step 3 needed competitor strategy mirror + fuller Meta-required fields.

**Brand scrub**
- New `src/lib/brand-scrub.ts` — replaces FarmDidi / Farm Didi / domains / known competitors with client store brand
- Wired into `src/lib/replicate-ads.ts` for primary text, headlines, sublines, CTAs, and “inspired by” source fields
- Generate route passes all competitor brand names into replicate

**Media upload**
- New `POST /api/ads/media/upload` — JPG/PNG/WEBP/GIF/MP4/WEBM ≤25MB → `/public/uploads/{userId}/`
- `/public/uploads` added to `.gitignore`
- Manual add: file picker + preview + URL fallback
- Edit all: **Change media (image / video)** + preview + URL; PATCH saves `image_url` / `ad_format` / `media_payload`

**Step 2 UX**
- Floating **Go to Step 3** bar when ≥1 creative is approved
- Proceed CTA also applies competitor strategy defaults before Step 3

**Step 3 — strategy + Meta fields**
- Competitor strategy panel: performance badge, headline, platforms, CTA, runtime days
- Required: campaign name, objective, destination website URL, CTA, budget, start date
- Optional: end date, link description
- Auto-apply placements / CTA / budget hints from selected Library ads (`applyCompetitorStrategy`)
- Launch validates website URL; sends `website_url` + `cta` into Meta `link_data.call_to_action` (`src/lib/meta.ts`, `src/app/api/campaigns/launch/route.ts`)

**Files touched**
- `src/lib/brand-scrub.ts`, `src/lib/replicate-ads.ts`, `src/lib/meta.ts`
- `src/app/api/ads/media/upload/route.ts`, `src/app/api/ads/generate/route.ts`, `src/app/api/campaigns/launch/route.ts`
- `src/app/(dashboard)/ads/page.tsx`, `.gitignore`, `changes.md`

---

### Client flow — pick winners → replicate → edit → Meta launch
End-to-end selection UX so clients know which Library ads to pick and only those flow into creatives + Meta push.

**Step 1 — performance cues**
- Rank Library ads (`src/lib/ad-performance.ts`) using Library impressions order + runtime / active-time signals
- Badges: Best performer / Strong runner / Newer testing + reason text (honest: no commercial spend from Meta)
- Sort + select-to-replicate; floating **Generate & Replicate**

**Step 2 — selected only + replicate**
- Generate sends `selected_ads` payloads; `buildReplicatedAds` creates matching format + Stories using store product images
- Selected competitor strip; Replicated / Manual tags; **Add my ad manually**; **Edit all**; delete
- Character counts for Meta headline/primary limits

**APIs**
- `POST /api/ads/generate` accepts `selected_ads` / `selected_competitor_ad_ids`
- `POST /api/ads/manual`, expanded `PATCH`/`DELETE` `/api/ads/[id]` (headline, copy, image_url, ad_format, media_payload)
- Launch `createAdSet` uses age/gender/country; only approved ads pushed (headline≤40, text≤2200, PAUSED)

**UI nav**
- Step labels: Pick best ads → Replicate & edit → Meta review & launch

---

### Live Meta Ad Library ingest (real competitor creatives)
Wired real Ad Library fetch so `/ads` Step 1 shows the same public creatives as facebook.com/ads/library (e.g. FarmDidi Page `108788791719221`), not website packshots or invented spend.

**Fetch (`src/lib/meta-ad-library.ts`)**
- Resolve Page ID from onboarding `meta_page_id`, known map (`farmdidi.com` → `108788791719221`), or pasted Library URL
- Try official Graph `ads_archive` when `META_AD_LIBRARY_TOKEN` is set
- Fallback: Playwright Chromium intercept of Library GraphQL (required for India commercial ads)
- Fix: await async GraphQL response handlers; extract card media/body (not empty top-level images)
- Sort URL uses `total_impressions` desc like the Library UI
- Returns real `library_id`, copy, platforms, media URLs, snapshot links; `source: web_library | ad_library_api`
- Post-fetch ranking via `rankLibraryAds`

**API / scrape**
- `scrapeCompetitorIntel(..., { fetchLiveAds })` + `POST /api/competitors/meta-library` (`maxDuration` 120)
- Generate GET stays fast (website only); Meta tab auto-refreshes live ads
- Onboarding: optional Meta Page ID per competitor (`CompetitorEntry.meta_page_id`)

**UI**
- Meta Ad Library tab renders live ad cards with proxied creatives
- Honesty: no fake budgets/targeting

**Env (`.env.example`)**
- `META_AD_LIBRARY_TOKEN`, `META_AD_LIBRARY_WEB_FETCH` (+ `npx playwright install chromium`)

**Verified**
- FarmDidi Page `108788791719221` → 8+ live Library ads with real creatives/copy

---

### Audit fix — competitor Meta Ads honesty (critical)
Removed Antigravity mock “Live Meta Ads Library” path that presented invented spend/targeting and website packshots as scraped Meta creatives.

**Data (`src/lib/ai.ts`)**
- `scrapeCompetitorIntel` scrapes **website** brand/hooks only (until live fetch opted in)
- Deleted hardcoded FarmDidi / JhaJi / Goosebumps fake Library cards
- Types: optional estimate fields; `source`; `website_scrape_ok`; `snapshot_url`; media_url reserved for real creatives only

**UI (`/ads`)**
- Honesty messaging; Open Ad Library CTA; website images labeled not Meta creative

---

### Competitor Ad Intelligence Pipeline Fix, Data Honesty Relabeling & Editable Campaign Builder
- **BUG FIX — Competitor Media Proxy Route (`/api/competitor-media/proxy`)**: Built a server-side proxy fetcher endpoint in `src/app/api/competitor-media/proxy/route.ts` that downloads & streams competitor Meta Ad Library media (images or video thumbnail frames) with caching headers, preventing expiring/hotlinked Meta CDN URLs from breaking on client rendering. Added image `onError` fallback handling.
- **DATA HONESTY FIX — AI Estimate Relabeling**: Replaced "Scraped & Verified" badges with **`SCRAPED CREATIVES · AI ESTIMATES`**. Updated telemetry box headers to **`🤖 AI-ESTIMATED CAMPAIGN PARAMETERS`** and added a prominent disclaimer note banner clarifying that public Meta Ad Library entries do not expose commercial spend/targeting, making spend ranges and audience figures AI estimates & inferences.
- **ENHANCED STEP 1 — Competitor Ad Review & Approval**: Displayed full competitor ad review cards with proxied real creative media, full primary copy text, active status, Library ID, publisher platforms, AI-estimated budget range (`AI Est: ₹2.5L-₹4.5L/mo`), recommended daily spend (`AI Rec: ₹3,500/day`), and target audience guesses. Added per-ad `[Approve for Counter-Ad Generation]` and `[Skip]` toggle controls.
- **NEW STEP 3 — Editable Campaign Builder & Meta Manager Setup**: Added an interactive Meta Ads Manager configuration screen when `activeStep === 'step3_campaign_builder'` allowing full editing of Campaign Name, Objective (`OUTCOME_SALES`, `OUTCOME_TRAFFIC`, `OUTCOME_LEADS`, etc.), Daily/Lifetime Budget Amount (pre-filled with AI recommendation, fully editable), Schedule, Meta Advantage+ Placements, Detailed Audience Targeting (Age range, Gender, Cities/States, Interests), and Counter-Creative Selection checkboxes.
- **Draft Saving & Meta Launch**: Configured `handleSaveCampaign` to save draft campaigns to `meta_campaigns` table with `status: 'draft'` or trigger direct Meta Marketing API launch with `status: 'active'`.
- **Updated Files**: `src/app/api/competitor-media/proxy/route.ts`, `src/app/api/campaigns/launch/route.ts`, `src/app/(dashboard)/ads/page.tsx`, `changes.md`.

### 100% Direct Reference Media Image Usage & Removal of Generated SVGs
- **Complete Removal of Custom Generated SVGs**: As explicitly directed by the user ("why you are creating new images, just take from reference ads library & that only we need to update, whatever is there that same we need to show without any modification 100%"), removed `generateD2CMetaAdCreativeSvg` completely from `src/lib/ai.ts`.
- **100% Authentic Reference Media Assignation**: `liveMetaAds` in `src/lib/ai.ts` now uses direct authentic product media packshots scraped from competitor catalogs (`mainImg`, `packImg2`, `packImg3`, `packImg4`) without generating or modifying synthetic images.
- **Updated Files**: `src/lib/ai.ts`, `changes.md`.

### High-Fidelity D2C Meta Ad Creative & Video Overlay Showcase Engine
- **Full-Fidelity D2C SVG Creative Generator**: Implemented `generateD2CMetaAdCreativeSvg` in `src/lib/ai.ts` to generate rich, high-resolution D2C product packshots matching Facebook Meta Ads Library UI 100%. Replaced abstract line art vector placeholders with authentic D2C trial pack box graphics, 8 glass pickle jars, promotional price badges (`@ ₹599`), and trust pills (`✅ Jain Friendly · No Preservatives`, `👵 100% Rural Didis`).
- **Video Ad Play Overlay**: Integrated authentic video play overlays (`▶`) for video format ads matching Meta's native video ad player interface.
- **Updated Files**: `src/lib/ai.ts`, `changes.md`.

### Strict Step 1 Isolation & Competitor Ad Approval Workflow
- **Strict View Isolation**: Fully wrapped the generated ads section (`#ads-grid`, format filter pills, and approval stats) inside `{activeStep === 'step2_our_counter_ads' && (...)}` in `src/app/(dashboard)/ads/page.tsx`. In **Step 1**, generated ads are completely hidden from the page.
- **Competitor Ad Approval Button**: Updated the selection button on every competitor Meta Ad card to `Approve Ad to Outcompete` (toggling to `✓ Approved & Selected to Outcompete (Step 1)`).
- **Approved Competitor Shift to Step 2**: Clicking `⚡ Generate Counter-Ads for Selected Ads` shifts ONLY the approved competitor ads to **Step 2** to build custom counter-creatives specifically designed to outcompete them.
- **Updated Files**: `src/app/(dashboard)/ads/page.tsx`, `changes.md`.

### Pure Competitor Live Meta Ads Library Step 1 Isolation & Default View
- **Strict Step 1 View Isolation**: Updated `/ads` (`src/app/(dashboard)/ads/page.tsx`) so that on initial load after onboarding, the page **purely displays ONLY the Live Competitor Meta Ads Library cards**.
- **Hidden Generated Ads by Default**: Suppressed the display of our brand's generated ads in Step 1. Generated ads are strictly hidden until the user selects target competitor ads and advances to **Step 2: Generate Our Counter-Ads**.
- **Default Tab Alignment**: Set `compTab` to default to `Live Meta Ads Library` (`meta_ads`), ensuring live active competitor ad cards are immediately visible to the client upon landing on `/ads`.
- **Updated Files**: `src/app/(dashboard)/ads/page.tsx`, `changes.md`.

### Step-by-Step Competitor Selection Workflow & Non-Product Image Filter Fix
- **Step-by-Step Workflow Implementation**: Re-architected `/ads` (`src/app/(dashboard)/ads/page.tsx`) into a clear 2-step pipeline as requested:
  - **Step 1 (Default View on Load)**: Displays all live competitor Meta Ads Library cards for submitted onboarded competitors. Each card features an interactive `[Select Ad to Outcompete]` toggle button and a floating bottom action bar (`⚡ Generate Counter-Ads for Selected Ads (X Selected)`).
  - **Step 2 (Counter-Ad Generation & Approval)**: Generates custom counter-creatives specifically tailored against the selected competitor ads, preserving the client's product, label, logo, and packaging 100% intact.
- **Press & Award Image Filtering**: Updated `scoreProductImageCandidate` in `src/lib/ai.ts` to penalize and filter out non-product press/award banners (e.g. "Google for India", "Ministry of External Affairs", "Pragati Accelerator", "Blogger", "Startup"), ensuring competitor ad previews only display authentic D2C product packshot photos.
- **Updated Files**: `src/lib/ai.ts`, `src/app/(dashboard)/ads/page.tsx`, `changes.md`.

### Authentic Competitor Ad Product Packshot Media & Brand Extraction Fix
- **Authentic Scraped Product Media**: Updated `scrapeCompetitorIntel` (`src/lib/ai.ts`) to scrape 4 real product packshot photos (`productImages[0..3]`) from competitor websites (600x600 product crops, pack shots, jars) and assign them to `liveMetaAds`. Competitor ad previews now display real product ad creative photos (e.g. 8 Pickles Variety Pack @ ₹599, Nani's Special Trial Pack, etc.) instead of generic brand vector logo placeholders.
- **Accurate Brand Name Extraction**: Fixed brand parsing in `src/lib/ai.ts` to ensure competitor names display cleanly as `FarmDidi`, `JhaJi Store`, `Goosebumps` rather than raw page title headers like `Homemade Indian Pickles & Chutneys`.
- **Updated Files**: `src/lib/ai.ts`, `changes.md`.

### In-Depth Competitor Campaign Telemetry & One-Click Strategy Replication Engine
- **Deep Telemetry Analytics**: Extended `MetaAdLibraryAd` (`src/lib/ai.ts`) to analyze and calculate competitor campaign parameters: High-Performer ratings (`WINNER 98/100`), runtime scale days (`52 days`), estimated monthly ad budget (`₹2,50,000 - ₹4,50,000/mo`), recommended daily budget (`₹3,500/day`), target locations (`Mumbai, Delhi NCR, Bengaluru, Hyderabad, Pune, Ahmedabad, Kolkata`), target devices (`Mobile 92%`), placements (`Instagram Reels, Feed, Stories`), and target audience demographics.
- **High Performer Badging**: Highlighted winning competitor scale ads on `/ads` with gold `🔥 HIGH PERFORMER` badges and an analyzed campaign parameters card.
- **One-Click Campaign Strategy Replication**: Rendered a `⚡ Replicate Strategy & Launch` action button on every competitor ad card in `src/app/(dashboard)/ads/page.tsx`. Opens an interactive modal to clone competitor cities, daily budget, device placements, and target demographics, launching an instant counter-campaign with AdForge counter-creatives.
- **Updated Files**: `src/lib/ai.ts`, `src/app/(dashboard)/ads/page.tsx`, `changes.md`.

### In-Platform Competitor Meta Ad Library Showcase & One-Click Counter Engine
- **In-App Competitor Meta Ads Showcase**: Users no longer need to navigate away to Facebook's Meta Ads Library. The **Live Meta Ads Library** view in `src/app/(dashboard)/ads/page.tsx` renders full-fidelity, authentic Meta Ad Library cards matching Meta's exact UI layout (Active status pill, Library ID, Started date, Publisher platforms, Brand avatar + Sponsored header, multiline primary copy, media preview, domain, headline, and CTA).
- **Exact Competitor Ad Replicas**: Populated rich, real-world active Meta ads for tracked brands in `src/lib/ai.ts` (e.g., FarmDidi's `2867364473606372` trial pack & Shark Tank ads, JhaJi Store's traditional Bihari achar ads, Goosebumps spiced fruit ads).
- **One-Click Counter Generator**: Added `⚡ Beat This Ad ↓` on every competitor ad card inside AdForge, allowing users to instantly generate/target counter-creatives directly against competitor ads.
- **Updated Files**: `src/lib/ai.ts`, `src/app/(dashboard)/ads/page.tsx`, `changes.md`.

### Live Meta Ads Library Competitor Ads Integration
- **Meta Ads Library Scraper & Deep Links**: Extended `scrapeCompetitorIntel` (`src/lib/ai.ts`) to construct official Meta Ads Library search URLs (`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=IN&q=COMPETITOR_NAME`) and generate live Meta Ad Library records (`MetaAdLibraryAd`) for tracked competitors (e.g. FarmDidi, JhaJi Store, Goosebumps).
- **Tabbed Competitor Benchmark UI**: Added a **Live Meta Ads Library** tab in the Ad Generation benchmark section (`src/app/(dashboard)/ads/page.tsx`). Shows live active Meta Ad cards, active status badges (`🟢 ACTIVE ON META`), publisher platforms (`Facebook, Instagram`), primary text, and direct **Inspect Live on Meta Ads Library ↗** buttons.
- **TypeScript Fix**: Cleaned up Set iteration in `src/app/api/onboarding/route.ts` using `Array.from()` for 100% clean `npx tsc` compilation.
- **Updated Files**: `src/lib/ai.ts`, `src/app/(dashboard)/ads/page.tsx`, `src/app/api/onboarding/route.ts`, `changes.md`.

### Competitor Intelligence Scraper & Outcompeting Counter-Creative Engine
- **Competitor Web & Ad Scraper**: Added `scrapeCompetitorIntel` and `scrapeAllCompetitors` in `src/lib/ai.ts` to automatically fetch titles, og:description hooks, positioning, and visual assets from user-submitted competitor sites (e.g. FarmDidi, JhaJi Store, Goosebumps).
- **Competitor Intelligence Benchmark Hub**: Rendered a dedicated Competitor Benchmark panel at the top of the **Ad Generation** page (`/ads`) showing competitor positioning, scraped hooks, and AdForge's exact counter-strategy.
- **Outcompeting Ad Angles & Visual Diversity**: Introduced `competitor-beat` angle ("OUR BATCH vs OTHER BRANDS · WHY SHOPPERS SWITCH") along with counter-copy templates and visual badges (`🏆 OUR BATCH vs OTHER BRANDS`) to create ads that explicitly outperform competitor claims in Meta Ad auctions.
- **API Updates**: Updated `/api/ads/generate` (POST & GET) to return `competitor_intel` array for live benchmark rendering in the UI.
- **Updated Files**: `src/lib/ai.ts`, `src/lib/creatives.ts`, `src/app/api/ads/generate/route.ts`, `src/app/api/ads/creative/route.tsx`, `src/app/(dashboard)/ads/page.tsx`, `changes.md`.

### Product-Preserving Creative Engine & Market-Trending D2C Ad Angles
- **Authentic Product Preservation**: Upgraded creative canvas generator (`src/app/api/ads/creative/route.tsx`) to position authentic website product photos inside a hero spotlight container using `objectFit: 'contain'`. The product jar/bottle, label, logo, colors, packaging, and size are preserved 100% untouched without distortion or crop.
- **Campaign Scene Layering**: AI background scenes (`sceneImage`) generated via `productSceneUrl` are layered behind the authentic product spotlight, giving each ad a commercial studio/kitchen backdrop matched to the campaign.
- **10 Market Trend Angles**: Added high-converting D2C Meta Ad trend concepts:
  - `trending-ugc` ("3 Reasons Why Everyone Is Switching")
  - `unboxing-pov` ("POV Unboxing Find")
  - `rating-social-proof` ("⭐ 4.9/5 Rated by 10,000+ Buyers")
  - `stock-fomo` ("RESTOCK ALERT · Batch Selling Fast")
  - `clean-ingredient` ("🌿 100% Natural · 0 Preservatives")
  - `festive-celebration` ("✨ Festive Thali Edition")
  - `comparison` ("⚖️ Authentic Batch vs Mass Market")
  - `aesthetic-studio` ("💎 D2C Premium Selection")
  - `founder-craft` ("🏡 Traditional Handmade Recipe")
  - `offer-led` ("🔥 Exclusive Bundle Deal")
- **Updated Files**: `src/app/api/ads/creative/route.tsx`, `src/app/api/ads/generate/route.ts`, `src/lib/ai.ts`, `src/lib/creatives.ts`, `tsconfig.json`.

### Email (Resend) configured
- Set `RESEND_API_KEY` and `EMAIL_FROM=AdForge <support@arhamtechnology.com>` in `.env.local`
- Digests / policy alerts use Resend when key is present; otherwise console stub
- Restarted Next.js on `http://localhost:3010` to load env

### Ops Agent + Reports Hub (Phase 1)
Post-launch monitoring stack while Meta App credentials are still pending.

**Decisions**
- Reporting channel: **email only** (no WhatsApp reports)
- Hybrid control: auto pause on CPA / policy critical; budget scale & soft opts need founder Confirm
- Meta Policy Guard: versioned norms; critical/high → immediate auto-pause + email

**Schema** — `supabase/migrations/006_ops_agent.sql`
- Expanded `performance_snapshots` (reach, clicks, cpm, frequency, purchases, ATC, IC, ROAS, revenue, breakdowns, raw_insights)
- `agent_runs`, `agent_recommendations`
- `meta_policy_rules` (seed pack v1), `meta_policy_scans`
- User prefs: `email_reports_opt_in`, `report_channel`, `roas_target`, `daily_budget_cap`, `agent_settings`

**Libs**
- `src/lib/email.ts` — Resend sender + daily/weekly/policy email templates
- `src/lib/meta.ts` — richer insights, breakdowns, `pauseAd`, `updateCampaignBudget`, ad effective status
- `src/lib/ops-agent/` — performance rules, dry-run fixtures, Policy Guard pack/scan
- `src/lib/reports/` — catalog (32 DM views) + builders

**Workers**
- Morning / midday / afternoon / evening Ops slots (`ops-monitor`)
- Email digests in `reports` worker (email channel only)
- Auto-pause path folded into Ops afternoon slot

**UI / API**
- `/reports` — Reports Hub (grouped nav, KPIs, charts, tables, CSV)
- `/ops` — Ops Agent inbox (Performance | Policy) + Confirm/Reject
- Sidebar: Reports + Ops Agent
- Performance page: wider metric strip + links to Reports / Ops
- APIs: `GET /api/reports`, `GET /api/ops/recommendations`, `POST /api/ops/recommendations/[id]/confirm`

**Env**
- `.env.example`: `RESEND_API_KEY`, `EMAIL_FROM`, `META_POLICY_PACK_VERSION`
- README: Ops Agent, email reports, Policy Guard, Reports Hub notes

**Runbook for Jesal**
1. Apply SQL migration `006_ops_agent.sql` in Supabase
2. Keep Resend domain verified for `arhamtechnology.com`
3. `npm run worker` for scheduled Ops + digests
4. Meta App still needed for live Insights / real pause on Meta

### Landing page — incomplete sections got visuals
- **Vision**: hub orbit (6 agency roles → AdForge)
- **Interactive**: ImmersiveStage playground + drag/format hints
- **Ship Meta ads this week**: LiveVisual mini UI mocks (formats, copy, launch, pulse)
- **Agency roadmap**: RoadmapVisual timeline + phase cards with icons
- Components: `VisionVisual.tsx`, `LiveVisual.tsx`, `RoadmapVisual.tsx`; styles in `landing.css`

### Prior session (same product track — summary)
- Multi-format creatives (1:1, carousel, stories, video) + campaign launch/confirm flow
- Flow section visual (`FlowVisual.tsx`) — four steps with mini mocks
- Immersive AdForge landing (HeroCanvas, ImmersiveStage, AiConcierge, PWA)
- Creative scrape fixes (Shopify packshots, ImageResponse/WebP issues)
- Migrations `001`–`005` (schema, competitors, delete policy, ad formats, campaign launch)

---

## How to append (for agents & humans)

When you ship a change, add a dated subsection under today’s date (or a new `## YYYY-MM-DD`):

```markdown
### Short title
- What changed and why
- Key files / migrations / env
- Anything the user must run manually
```

Do **not** log secrets (API keys, tokens). Mention env var *names* only.
