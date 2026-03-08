# Google Sheets Content Backend (Editorial Mirror + Optional CSV Overrides)

This workflow assumes one Google Sheet with a tab for each C+B page. The repo keeps a CSV mirror for each tab under `data/`, while the live site defaults to the page JSON files unless you intentionally override a page with a published CSV.

## 1) Google Sheet tab map
Use these exact tab names and match them to the local CSV files:

- `Content` -> `data/cnb-homepage-content-table.csv`
- `Membership` -> `data/cnb-membership-content-table.csv`
- `work-with-amanda` -> `data/cnb-work-with-amanda-content-table.csv`
- `About` -> `data/cnb-about-content-table.csv`
- `Learn` -> `data/cnb-learn-content-table.csv`
- `blind-dinners` -> `data/cnb-blind-dinners-content-table.csv`
- `Stories` -> `data/cnb-stories-content-table.csv`
- `thank-you-business-counsel` -> `data/cnb-thank-you-business-counsel-content-table.csv`
- `thank-you-strategic-partnership` -> `data/cnb-thank-you-strategic-partnership-content-table.csv`
- `apply-strategic-partnership` -> `data/cnb-apply-strategic-partnership-content-table.csv`
- `apply-business-counsel` -> `data/cnb-apply-business-counsel-content-table.csv`

Each tab should keep the same header row:
`section, field, value, link, notes`

## 2) Default runtime behavior
By default, every page mount loads its matching JSON file from `data/` through `js/cnb-loader.js`.

That means the normal repo-backed page files are:
- `data/cnb-homepage.json`
- `data/cnb-membership.json`
- `data/cnb-work-with-amanda.json`
- `data/cnb-about.json`
- `data/cnb-learn.json`
- `data/cnb-blind-dinners.json`
- `data/cnb-stories.json`
- `data/cnb-apply-business-counsel.json`
- `data/cnb-apply-strategic-partnership.json`
- `data/cnb-thank-you-business-counsel.json`
- `data/cnb-thank-you-strategic-partnership.json`

## 3) Optional per-page published CSV override
If you want a specific page to read directly from a published Google Sheet CSV instead of the repo JSON, publish that tab to the web and set `data-cnb-src` on that page's mount.

Example:
```html
<div
  data-cnb-home-root
  data-cnb-page="membership"
  data-cnb-src="PASTE_THE_PUBLISHED_MEMBERSHIP_CSV_URL"
></div>
```

If you do not set `data-cnb-src`, the page uses the repo JSON.

## 4) Squarespace footer injection
Use the shared loader in page footer injection:
```html
<script defer src="https://cdn.jsdelivr.net/gh/scampbe3/CNB@main/js/cnb-loader.js"></script>
```

## 5) Page embed snippets
Use the matching snippet from `html/` for each Squarespace page code block.

Examples:
- `html/cnb-homepage-embed.html`
- `html/cnb-membership-embed.html`
- `html/cnb-work-with-amanda-embed.html`
- `html/cnb-about-embed.html`
- `html/cnb-learn-embed.html`
- `html/cnb-blind-dinners-embed.html`
- `html/cnb-stories-embed.html`
- `html/cnb-apply-business-counsel-embed.html`
- `html/cnb-apply-strategic-partnership-embed.html`
- `html/cnb-thank-you-business-counsel-embed.html`
- `html/cnb-thank-you-strategic-partnership-embed.html`

## 6) Validation
After deploy and hard refresh:
```js
window.CNB_LAST_CONTENT_SOURCE
window.CNB_LAST_CONTENT_DATA?.page
window.CNB_LAST_CONTENT_DATA?.sections?.[0]?.title
```

If the page is running from repo JSON, the content source should resolve to `fetch` or `fallback`.
If the page is intentionally running from a published CSV, the content source should resolve to `csv` or `gviz`.
