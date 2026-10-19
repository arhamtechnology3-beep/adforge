# Diwali Campaign — New Creatives + Taglines

Four Meta ads, four taglines, four festival **scenes**. Product **logo, brand colors, label, and jar geometry** stay on the real packshot (background-only AI + composite).

## Locked taglines

| Ad | Tagline | Headline (≤40) | Visual preset |
|----|---------|----------------|---------------|
| A | Diwali ki thali… achaar ke bina adhuri! 😍 | Thali incomplete without achaar | Diwali Thali Incomplete |
| B | Some flavours always feel like home. | Flavours that feel like home | Diwali Flavours of Home |
| C | This Diwali, bring home the taste of tradition! 🪔 | Taste of tradition this Diwali | Diwali Taste of Tradition |
| D | Ghar ka swaad, Diwali wali thali pe. | Ghar ka swaad on your thali | Diwali Ghar Ka Swaad Stories (9:16) |

## Brand integrity

- AI generates **environment only** (thali, diyas, marigold, lighting).
- Real packshot is composited afterward — never redraw logo/label.
- Reject any output where branding looks soft, recolored, or invented.

## Publish path (manual)

1. Open `/ads` → select your **real** product packshot.
2. Set **Tone** to **Diwali festive** (auto-sets variants to 4) **or** pick wizard template **Diwali Achaar Creative Test**.
3. **Best variants = 4** → **Regenerate pack**.
4. QA all 4: logo + brand colors intact; regenerate scene only if not.
5. Confirm copy uses the four taglines; CTA **Shop Now** to store URL.
6. Publish as a **new** campaign (`Diwali · Creative Test`) — do not reuse fatigued creatives.
7. Run **48–72h**, pause losers, scale the winning tagline + visual.

## Code paths

- Taglines + directions: `src/lib/creative-engine/diwali-campaign.ts`
- Scene presets: `docs/facebook_meta_product_ad_prompts.md` (#12–#15)
- Template: `diwali-achaar` in `src/lib/campaign-templates.ts`
