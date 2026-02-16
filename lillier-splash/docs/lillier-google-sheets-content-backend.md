# Lillier Homepage CSV Backend (Google Sheets)

This mirrors the C+B pattern: content lives in a CSV-shaped table that the client edits in Google Sheets.

For Shopify, this is a **sync workflow** (not runtime fetch in Liquid):

`Google Sheet -> published CSV -> pipeline sync -> Shopify theme files`

## 1) Source table
- Primary file: `data/lillier-homepage-content-table.csv`
- JSON mirror used by sync script: `data/lillier-homepage-content-table.json`
- Columns stay fixed: `section, field, value, link, notes`

## 2) Google Sheet setup
1. Create/open a sheet (example: `Lillier Homepage Content`).
2. Add a tab named `Content`.
3. Paste all rows from `data/lillier-homepage-content-table.csv` (including header row).
4. Client edits only `value` and `link` cells unless instructed otherwise.

## 3) Published CSV link
Google Sheets -> File -> Share -> Publish to web
- Link: `Content`
- Format: `Comma-separated values (.csv)`
Keep this URL. It will be used by automation as:
- GitHub secret: `LILLIER_SHEET_CSV_URL`

## 4) No-client-script automation (recommended)
Client should not run scripts.

Use:
- GitHub Action: `.github/workflows/lillier-sheet-sync.yml`
- Google Apps Script debounce dispatcher: `lillier-splash/docs/lillier-sheet-autosync-apps-script.gs`

### 4.1 GitHub repo secrets
Set these in GitHub -> Settings -> Secrets and variables -> Actions:
- `LILLIER_SHEET_CSV_URL` = published Google CSV URL

### 4.2 Google Apps Script properties
In the Sheet's Apps Script project, add script properties:
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_TOKEN` (token allowed to dispatch workflow on repo)

Then:
1. Paste the script from `lillier-splash/docs/lillier-sheet-autosync-apps-script.gs`.
2. Run `installLillierOnEditTrigger_()` once to install the onEdit trigger.
3. From then on:
   - edits on `Content` tab set a dirty flag,
   - a 1-minute debounced timer fires once,
   - script sends `repository_dispatch` (`lillier_sheet_dirty`) to GitHub,
   - workflow syncs CSV into theme files and commits only if changed.

### 4.3 Preview theme behavior
If your Shopify preview theme is connected to this repo branch, sheet edits will flow into preview automatically after the workflow run.

## 5) Manual fallback (developer run)
If needed, run manually:

```bash
curl -fsSL "$LILLIER_SHEET_CSV_URL" -o data/lillier-homepage-content-table.csv

perl scripts/lillier-content-pipeline.pl import-csv \
  --in data/lillier-homepage-content-table.csv \
  --out data/lillier-homepage-content-table.json

perl scripts/lillier-content-pipeline.pl sync \
  --table data/lillier-homepage-content-table.json \
  --template lillier-splash/shopify-theme/templates/index.json \
  --settings lillier-splash/shopify-theme/config/settings_data.json
```

## 6) What sync updates
- Homepage template content:
  - `lillier-splash/shopify-theme/templates/index.json`
  - Sections: announcement, hero, categories, spotlight, difference, closing, footer
  - Category labels and difference points (block rows)
- Global text settings:
  - `lillier-splash/shopify-theme/config/settings_data.json`
  - Banner text, trust line, footer support line, cart helper, shipping note, sister-site text/url

## 7) Comma-safety (same issue solved in C+B)
The importer includes C+B-style row normalization for malformed comma rows:
- if commas break a row shape, extra cells are merged back into `value`/`notes`
- URL-like cells still map to `link`
- valid quoted CSV still works normally

This logic is in:
- `scripts/lillier-content-pipeline.pl` (`normalize_content_row`)

Google's published CSV already quotes commas correctly, but this guard prevents content drop if a row is malformed.

## 8) Optional convenience commands
Export current table JSON back to CSV:

```bash
perl scripts/lillier-content-pipeline.pl export-csv \
  --in data/lillier-homepage-content-table.json \
  --out data/lillier-homepage-content-table.csv
```
