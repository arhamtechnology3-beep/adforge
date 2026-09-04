# Facebook / Instagram Product Ad Image Prompt Library

A reusable prompt library for generating Meta ad creatives while preserving the original product exactly.

> **AdForge integration:** Presets are loaded at runtime from this file (`docs/facebook_meta_product_ad_prompts.md`). Edit prompts here and regenerate ads — no code changes needed. AdForge adapts prompts for **background-only** compositing (packshot overlaid separately) — product placement lines are stripped automatically before sending to AI.

---

## How to Use

For every generation:

1. Upload the **original product image** as the reference image.
2. Select one creative prompt from this file.
3. Append the **Master Product-Protection Negative Prompt** at the end.
4. Generate the image.
5. Verify the product, logo, branding, color, shape, and proportions before using the creative in an ad.

> **Important:** Negative prompts reduce unwanted changes but cannot guarantee perfect preservation of tiny logos or text. For critical branding, verify the final image and restore the original logo/product artwork in post-production when necessary.

---

# Master Product-Protection Negative Prompt

```text
IMPORTANT PRODUCT PRESERVATION INSTRUCTIONS:

Use the uploaded reference product image as the absolute source of truth.

Do NOT modify, redesign, reinterpret, regenerate, stylize, reshape, or alter the actual product.

Preserve the exact:
- product shape
- product proportions
- product dimensions
- product size
- product structure
- product geometry
- product material
- product texture
- product finish
- product color
- product color tones
- product patterns
- product design
- product components
- buttons
- controls
- openings
- edges
- curves
- stitching
- labels
- printed elements
- typography
- logo
- brand name
- branding
- packaging
- product markings
- serial/identification markings if visible

The logo must remain EXACTLY as shown in the reference image.
Do not recreate, replace, redraw, distort, remove, simplify, beautify, or invent the logo.

Do not change the brand identity.

Do not add accessories to the product.
Do not remove any existing product component.
Do not change the number of components.
Do not change the product's physical construction.

Do not create a fictional version of the product.

The product must remain photorealistic and commercially accurate.

ONLY modify:
- background
- environment
- lighting
- shadows
- reflections
- camera composition
- camera angle ONLY if the original product geometry remains accurate
- surrounding props
- atmosphere
- color grading of the environment
- depth of field
- visual styling
- advertising composition

The surrounding environment must NEVER visually merge with, deform, overlap, or modify the product.

Keep the product clearly recognizable and identical to the reference image.

No product hallucination.
No product redesign.
No logo hallucination.
No branding alteration.
No color shift.
No shape distortion.
No incorrect proportions.
No duplicate product.
No extra product parts.
No missing product parts.
No fake text on the product.
No fake logo.
No watermark.
No random text.
No unnecessary typography.

The final result must look like a premium real-world commercial product photograph created using the ORIGINAL PRODUCT.
```

---

# 1. Premium Luxury Studio

**Best for:** Premium products, electronics, fashion accessories, beauty, lifestyle products.

```text
Create a premium high-end commercial advertisement using the uploaded product image as the exact product reference.

Place the original product as the hero subject in a sophisticated luxury studio environment.

Use a minimal architectural background with elegant neutral tones, subtle gradients, premium textured surfaces, soft directional studio lighting, realistic contact shadows, controlled highlights and a subtle cinematic atmosphere.

The product should be positioned prominently in the center with generous negative space around it.

Create realistic professional product photography with:
- soft key light
- subtle rim light
- realistic floor reflection
- controlled shadows
- shallow depth of field
- premium editorial composition
- high-end commercial photography
- clean luxury aesthetic

The image should immediately communicate PREMIUM, TRUST, QUALITY and DESIRABILITY.

Keep the background visually interesting but never allow it to compete with the product.

Photorealistic, sophisticated, minimal, premium advertising campaign, realistic materials, realistic lighting, high detail, professional studio photography.

[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT]
```

---

# 2. Natural Lifestyle Environment

**Best for:** Home products, food, wellness, beauty, kitchen, furniture, lifestyle products.

```text
Create a premium lifestyle advertisement using the uploaded product as the exact hero product.

Place the original product naturally inside a beautiful modern lifestyle environment that matches its category.

Use an aesthetically pleasing environment with natural materials such as light wood, stone, linen, ceramic, plants or subtle architectural elements.

Use warm natural sunlight entering from one side, soft realistic shadows and gentle highlights.

The scene should feel like a real premium lifestyle photograph rather than a digitally generated advertisement.

Create an aspirational but believable environment.

Composition:
- product remains the primary focus
- product placed prominently in foreground
- supporting objects remain secondary
- realistic depth
- natural perspective
- subtle background blur
- premium editorial photography

Use tasteful neutral and earthy tones while keeping the original product's exact colors unchanged.

Photorealistic commercial photography, natural lighting, realistic textures, premium lifestyle advertising, sophisticated composition.

[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT]
```

---

# 3. Bold Scroll-Stopping Facebook Ad

**Best for:** Products where maximum attention in the social feed is the priority.

```text
Create a high-impact Facebook and Instagram advertising creative using the uploaded product image as the exact hero product.

Design the scene specifically to stop users while scrolling through a social media feed.

Use a bold but premium background with strong visual contrast, dramatic lighting, subtle atmospheric elements and a clean modern advertising composition.

Make the product visually dominant and immediately recognizable.

Use:
- dramatic studio lighting
- strong directional light
- subtle glow behind the product
- realistic shadow
- premium gradient environment
- strong depth
- high contrast
- clean negative space
- modern commercial photography

Create visual hierarchy where the viewer's eye immediately lands on the product.

The background should be visually exciting without touching, covering or altering the product.

The final image should look like a professional performance-marketing creative from a premium D2C brand.

Photorealistic, high-impact, modern, premium, attention-grabbing, social-media advertising photography.

[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT]
```

---

# 4. Sunlight + Premium Home

**Best for:** Products that belong in homes.

```text
Create a photorealistic premium home lifestyle advertisement using the uploaded product as the exact hero product.

Place the original product inside a beautiful contemporary home with sophisticated interior design.

Use large windows with soft morning sunlight entering the room.

Create realistic sunlight patterns, soft shadows, subtle reflections and natural atmospheric depth.

The environment should contain tasteful supporting elements such as:
- premium furniture
- natural wood
- stone
- plants
- books
- subtle decorative objects

Keep all surrounding elements understated.

The original product must remain the visual hero.

Use a cinematic composition with the product occupying approximately 40–60% of the visual attention.

Create a warm, aspirational and emotionally appealing lifestyle advertisement.

Photorealistic photography, natural sunlight, realistic interior, premium editorial advertising, sophisticated home aesthetic.

[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT]
```

---

# 5. Minimal Clean Product Ad

**Best for:** Modern products, technology, cosmetics, premium accessories.

```text
Create an ultra-clean premium product advertisement using the uploaded product image as the exact product reference.

Place the original product against a sophisticated minimalist environment.

Use a seamless architectural background with subtle gradients and premium materials.

Create a visually clean composition with:
- large negative space
- soft diffused lighting
- subtle floor shadow
- delicate reflection
- smooth gradient background
- precise product placement
- high-end studio photography

The overall visual language should feel modern, expensive, elegant and highly trustworthy.

Avoid clutter completely.

The product must remain extremely sharp and detailed while the background has subtle depth of field.

Create the visual style of a premium international consumer brand advertisement.

Photorealistic, minimal, elegant, clean, sophisticated, high-end commercial product photography.

[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT]
```

---

# 6. Dark Cinematic Premium

**Best for:** Electronics, automotive products, watches, luxury products, premium gadgets.

```text
Create a dramatic cinematic commercial advertisement using the uploaded product as the exact hero product.

Place the product inside a dark premium environment with sophisticated architectural surfaces.

Use controlled cinematic lighting:
- dramatic key light
- subtle rim lighting
- realistic reflections
- deep shadows
- soft atmospheric haze
- subtle highlights
- realistic contact shadow

Create a premium dark environment that makes the product visually stand out.

The product should be brighter and more visually prominent than the background.

Use cinematic depth of field and realistic studio-quality reflections.

The final image should feel like a luxury product launch campaign.

High-end commercial photography, cinematic lighting, photorealistic materials, dramatic composition, premium advertising aesthetic.

[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT]
```

---

# 7. Soft Beauty / Instagram Aesthetic

**Best for:** Cosmetics, skincare, jewelry, fashion, beauty, lifestyle.

```text
Create a sophisticated Instagram and Facebook lifestyle advertisement using the uploaded product as the exact hero product.

Build an elegant aesthetic environment using soft natural textures, subtle pastel tones, premium stone or ceramic surfaces and delicate decorative elements.

Use soft diffused daylight with gentle highlights and realistic shadows.

Create a refined editorial beauty campaign aesthetic.

Composition should include:
- hero product in foreground
- subtle supporting props
- soft background blur
- clean negative space
- elegant visual balance
- premium photography
- realistic materials

Keep the environment sophisticated rather than overly decorative.

The final image should feel like a premium beauty/lifestyle brand campaign designed for Instagram and Facebook.

Photorealistic, elegant, aesthetic, soft lighting, premium editorial photography.

[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT]
```

---

# 8. Fresh / Clean / Refreshing

**Best for:** Food, beverages, skincare, wellness, cleaning products, water-related products.

```text
Create a fresh, clean and visually refreshing Facebook advertisement using the uploaded product as the exact hero product.

Place the original product in a premium bright environment inspired by freshness and cleanliness.

Use an elegant combination of natural surfaces, subtle water droplets in the surrounding environment, soft reflections, fresh atmospheric lighting and clean visual space.

Use bright natural lighting with realistic shadows.

Create a sense of:
FRESHNESS + CLEANLINESS + QUALITY + TRUST.

Add subtle environmental elements that support the product category without distracting from the original product.

Use a premium commercial photography style with realistic depth of field and sophisticated composition.

The product should remain perfectly sharp and visually dominant.

Photorealistic, fresh, clean, premium, modern, high-end advertising photography.

[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT]
```

---

# 9. Modern Urban / Premium Brand

**Best for:** Tech, fashion, accessories, lifestyle products.

```text
Create a premium modern urban advertisement using the uploaded product as the exact hero product.

Place the product in a sophisticated contemporary urban environment.

Use architectural elements such as modern concrete, glass, brushed metal, premium stone and subtle city-inspired details.

Create cinematic evening or golden-hour lighting.

Use realistic environmental reflections, soft shadows and atmospheric depth.

The composition should feel like a major international brand campaign.

Keep the product in the foreground and make it dramatically more visually important than the environment.

Create a sophisticated visual hierarchy with strong negative space.

Photorealistic commercial photography, contemporary architecture, cinematic lighting, premium brand campaign, realistic materials, high detail.

[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT]
```

---

# 10. Problem → Solution Visual

**Best for:** Performance marketing and conversion-focused campaigns.

```text
Create a high-converting Facebook advertisement using the uploaded product as the exact hero product.

Create a visually compelling environment that communicates the product's primary benefit without changing the product itself.

Show the product in a realistic situation where its purpose and value are immediately understandable.

Use a premium lifestyle environment with subtle contextual elements that communicate the product's use case.

Composition:
- original product prominently positioned in foreground
- realistic usage context
- supporting environment in background
- strong visual hierarchy
- clear focal point
- realistic lighting
- realistic shadows
- premium commercial photography
- subtle cinematic depth

The image should communicate the feeling:
"THIS PRODUCT SOLVES MY PROBLEM."

Avoid complicated compositions.

Keep the environment believable and aspirational.

Photorealistic performance-marketing creative, premium D2C advertising, emotionally compelling, highly realistic.

[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT]
```

---

# 11. Premium UGC Style

**Best for:** Social-feed-native ads and products that benefit from an authentic feel.

```text
Create a realistic premium social-media advertisement using the uploaded product as the exact hero product.

Make the image feel like an authentic high-quality lifestyle photograph captured for a modern social media brand rather than a traditional studio advertisement.

Place the original product naturally in a believable real-world environment relevant to the product category.

Use natural imperfect details, realistic daylight, authentic environmental textures, subtle shadows and believable depth.

The composition should feel spontaneous but professionally photographed.

Avoid an overly perfect artificial studio appearance.

Use an aesthetic modern environment with carefully selected supporting objects.

The product must remain the clear hero.

Create the visual style of premium UGC-inspired advertising used by successful direct-to-consumer brands.

Photorealistic, authentic, natural, premium social media aesthetic, realistic lighting, believable environment, high-quality commercial photography.

[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT]
```

---

# Creative Testing Matrix

| Creative | Background / Environment | Main Purpose |
|---|---|---|
| Premium Luxury Studio | Luxury studio | Premium positioning |
| Natural Lifestyle | Modern lifestyle environment | Trust + aspiration |
| Bold Scroll Stopper | High-contrast environment | Attention |
| Sunlight + Premium Home | Contemporary home | Lifestyle |
| Minimal Clean | Minimal studio | Product clarity |
| Dark Cinematic | Dark premium environment | Luxury |
| Soft Beauty | Beauty/editorial environment | Instagram appeal |
| Fresh / Clean | Bright fresh environment | Emotional association |
| Modern Urban | Contemporary architecture | Modern branding |
| Problem → Solution | Realistic use-case environment | Conversion |
| Premium UGC | Authentic real-world environment | Native social feel |

---

# Important Product Rule

The AI should modify the **environment**, not the product.

```text
PRODUCT = LOCKED
BACKGROUND = VARIABLE
LIGHTING = VARIABLE
PROPS = VARIABLE
COMPOSITION = VARIABLE
ATMOSPHERE = VARIABLE
```
