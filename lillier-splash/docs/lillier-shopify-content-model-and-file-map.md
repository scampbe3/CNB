# Lillier Shopify Build Draft
Status: Implementation draft  
Scope: Initial architecture, content model, file map, and phased rollout for `lillier.co` (Shopify)

## 1. Product Intent and Constraints
- Lillier is a high-frequency ecommerce destination (`daily/weekly` utility + discovery).
- Relationship to C+B should be subtle: shared design DNA, no explicit co-branding narrative.
- Mobile-first is non-negotiable.
- Client must be able to edit critical content post-handoff without code.
- We want C+B-like engineering sanity: structured data, predictable templates, minimal ad hoc admin edits.

## 2. Architecture Strategy (C+B Analog, Shopify-Native)
### Recommended pattern
- Custom Shopify OS 2.0 theme with:
  - `JSON templates` for page composition
  - `Custom sections/snippets` for reusable blocks
  - `Theme settings + section settings + metafields/metaobjects` for editable content
- Keep core behavior centralized in:
  - `assets/lillier-core.css`
  - `assets/lillier-core.js`
- Avoid app-heavy page builder dependence for core templates.

### Why this matches C+B architecture
- C+B uses explicit structure and controlled render logic.
- Shopify equivalent is `section schema + template JSON + typed content fields` instead of freeform WYSIWYG.
- This preserves maintainability while enabling client self-service edits.

## 3. Theme File Map (Initial)
```text
layout/
  theme.liquid

templates/
  index.json
  page.about.json
  collection.json
  product.json
  cart.json
  blog.json
  article.json

sections/
  lillier-announcement-bar.liquid
  lillier-header.liquid
  lillier-hero-editorial.liquid
  lillier-category-rail.liquid
  lillier-brand-spotlight.liquid
  lillier-difference-grid.liquid
  lillier-closing-cta.liquid
  lillier-footer-utility.liquid
  main-collection-product-grid.liquid
  main-product.liquid
  main-cart-footer.liquid

snippets/
  lillier-media.liquid
  lillier-button.liquid
  lillier-section-shell.liquid
  lillier-product-card.liquid
  lillier-trust-line.liquid
  lillier-eyebrow.liquid

assets/
  lillier-core.css
  lillier-core.js
  lillier-tokens.css
  lillier-critical.css
```

## 4. Content Ownership Model
## 4.1 Theme settings (global)
Editable by client in Theme Editor:
- `global_banner_text`
- `cart_helper_text`
- `shipping_note_text`
- `trust_line_default`
- `footer_support_line`
- `social_links`
- `sister_site_link_label` (optional subtle)
- `sister_site_link_url` (optional subtle)

## 4.2 Section settings (page-level narrative control)
Editable by client in Theme Editor per template instance:
- Homepage hero copy/CTAs
- Category section headline and intro
- Spotlight headline and CTA text
- Difference section headline and support points
- About page narrative blocks and CTA labels

## 4.3 Shopify objects (commerce truth)
- Collections = category structure
- Products = catalog truth
- Search & Discovery app = filters, merchandising rules

## 4.4 Metafields (typed enrichment)
### Product metafields
- `custom.verified_black_owned` (boolean)
- `custom.brand_name_override` (single_line_text_field)
- `custom.shipping_note_override` (multi_line_text_field)
- `custom.story_reference` (metaobject_reference: `brand_story`)

### Collection metafields
- `custom.hero_image_mobile` (file_reference)
- `custom.editorial_subhead` (single_line_text_field)

### Page metafields (optional if using section-only is too limiting)
- `custom.eyebrow`
- `custom.hero_variant`

## 4.5 Metaobjects
### `brand_story`
Fields:
- `title`
- `slug`
- `brand_name`
- `owner_name`
- `thumbnail_image`
- `hero_image`
- `excerpt`
- `body`
- `primary_cta_label`
- `primary_cta_url`
- `is_featured` (boolean)

Used by:
- Homepage spotlight
- `/blogs/stories` and article templates
- Product cross-linking via metafield reference

## 5. Section Specs (with setting IDs)
## 5.1 `sections/lillier-hero-editorial.liquid`
Purpose: homepage first impression, editorial + utility

Settings:
- `eyebrow` (`text`)
- `heading` (`textarea`)
- `subhead` (`textarea`)
- `body` (`richtext`)
- `primary_cta_label` (`text`)
- `primary_cta_url` (`url`)
- `secondary_cta_label` (`text`)
- `secondary_cta_url` (`url`)
- `media_desktop` (`image_picker`)
- `media_mobile` (`image_picker`)
- `media_focus_x` (`range`, 0-100, default 50)
- `media_focus_y` (`range`, 0-100, default 50)
- `theme_variant` (`select`: `gold`, `cream`, `ink`)

## 5.2 `sections/lillier-category-rail.liquid`
Purpose: utility-first browse path

Section settings:
- `heading`
- `intro`
- `cta_label`
- `cta_url`

Blocks: `category_card` (max 8)
- `collection_ref` (`collection`)
- `label_override` (`text`)
- `support_text` (`text`)
- `image_override` (`image_picker`)

## 5.3 `sections/lillier-brand-spotlight.liquid`
Purpose: story + trust + discovery

Section settings:
- `heading`
- `body`
- `source_mode` (`select`: `manual`, `featured_metaobject`)

If `manual`:
- `manual_image`
- `manual_title`
- `manual_excerpt`
- `manual_cta_label`
- `manual_cta_url`

If `featured_metaobject`:
- resolve first `brand_story.is_featured == true`

## 5.4 `sections/lillier-difference-grid.liquid`
Purpose: communicate "more than marketplace"

Section settings:
- `heading`
- `body`
- `primary_cta_label`
- `primary_cta_url`

Blocks: `difference_point` (max 6)
- `point_text`

## 5.5 `sections/lillier-closing-cta.liquid`
Purpose: conversion close

Settings:
- `heading`
- `body`
- `cta_label`
- `cta_url`

## 5.6 `sections/lillier-footer-utility.liquid`
Purpose: concise utility footer with trust line

Settings:
- `footer_line_override` (optional)
- `show_sister_link` (checkbox)

## 6. Template Composition
## 6.1 `templates/index.json`
Section order:
1. `lillier-announcement-bar`
2. `lillier-header`
3. `lillier-hero-editorial`
4. `lillier-category-rail`
5. `lillier-brand-spotlight`
6. `lillier-difference-grid`
7. `lillier-closing-cta`
8. `lillier-footer-utility`

## 6.2 `templates/page.about.json`
Section order:
1. `lillier-header`
2. `lillier-hero-editorial` (about variant)
3. `lillier-story-richtext` (our story)
4. `lillier-story-richtext` (why lillier exists)
5. `lillier-story-richtext` (our name)
6. `lillier-closing-cta`
7. `lillier-footer-utility`

## 6.3 `collection.json` and `product.json`
- Keep native Shopify `main-*` sections but style them through `lillier-core.css`.
- Inject trust and utility copy via snippets/metafields, not hardcoded body HTML.

## 7. UX and Behavior Rules
- Mobile-first spacing and card hierarchy before desktop polish.
- No dense dashboard UI patterns.
- Keep CTA count low and clear per section.
- Typography and white space do most of the visual work.
- Product cards prioritize utility data (`price`, `availability`, quick add where appropriate).
- Cart/checkout helper messaging always visible where relevant.

## 8. Analytics + SEO Foundation
- Implement core GA4 events:
  - `view_item_list`, `select_item`, `view_item`, `add_to_cart`, `begin_checkout`, `purchase`
- JSON-LD:
  - Product, Organization, Breadcrumb, Article as applicable
- Collection metadata:
  - title and description templates
- Image hygiene:
  - always alt text (theme warning if empty in manual fields)

## 9. Rollout Phases
## Phase 0: Setup (0.5 day)
- Clone baseline theme and create `lillier-dev` branch/theme copy.
- Add token and core asset scaffolding.

## Phase 1: Design system + shell (1 day)
- Implement `theme.liquid`, header/footer shell, tokens, core layout primitives.

## Phase 2: Homepage sections (1.5 to 2 days)
- Build and wire sections 5.1 through 5.5.
- Enter provided homepage copy from client doc.

## Phase 3: About page + story object model (1 day)
- Implement about template and `brand_story` metaobject.

## Phase 4: Collection/product/cart styling + trust layer (1.5 days)
- Apply Lillier visual system to core commerce templates.
- Add trust line + shipping note surfaces.

## Phase 5: QA + polish + handoff docs (1 day)
- Mobile QA, accessibility pass, performance checks, edit guide.

## 10. Handoff Editing Guide (Client)
Provide a short admin playbook covering:
- Change homepage copy/CTAs
- Reorder category cards
- Swap spotlight brand story
- Update global trust and helper text
- Update about page narrative blocks
- Add a verified brand marker on products

## 11. Decisions to Confirm Before Build
1. Use `brand_story` metaobject for spotlight now, or keep spotlight manual for phase 1?
2. Include subtle footer link to C+B at launch, or hold for phase 2?
3. Quick add on collection cards at launch, or product-page-first flow?
4. Any mandatory Shopify apps beyond Search & Discovery?
