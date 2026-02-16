# Lillier Shopify Theme Scaffold

This is an OS 2.0 starter scaffold aligned to the planning doc in:

- `lillier-splash/docs/lillier-shopify-content-model-and-file-map.md`

## Included

- `layout/theme.liquid` shell
- JSON templates for `index`, `page.about`, `collection`, `product`, `cart`, `blog`, `article`
- Lillier custom sections and reusable snippets
- Global tokenized CSS + core JS
- Theme settings schema for client-editable global text/links

## Client-Editable Areas (No Code)

- Theme settings:
  - Announcement bar text
  - Cart/shipping/trust/footer helper lines
  - Social links
  - Optional sister-site link
- Per-section copy/media/CTAs via Theme Editor
- Product/Collection content in Shopify admin

## CSV Content Layer (Google Sheets Workflow)

Lillier homepage content also has a C+B-style CSV source-of-truth layer:

- `data/lillier-homepage-content-table.csv`
- `data/lillier-homepage-content-table.json`
- `scripts/lillier-content-pipeline.pl`

Workflow docs:

- `lillier-splash/docs/lillier-google-sheets-content-backend.md`
- GitHub automation: `.github/workflows/lillier-sheet-sync.yml`
- Apps Script debounce dispatcher: `lillier-splash/docs/lillier-sheet-autosync-apps-script.gs`

## Next Build Steps

1. Create a duplicate development theme in Shopify.
2. Upload this scaffold with Shopify CLI.
3. Connect real navigation menus in `Lillier Header`.
4. Replace placeholder copy in homepage/about sections with approved client copy.
5. Create `brand_story` metaobject + product/collection metafields and wire to `lillier-brand-spotlight`.
6. QA mobile-first spacing and typography against client references in `lillier-splash/lillier-branding/`.
