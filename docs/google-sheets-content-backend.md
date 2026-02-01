# Google Sheets Content Backend (Published CSV)

This is the **no‑script** workflow. The client edits a Google Sheet, and the site reads a published CSV directly.

## 1) Create / prepare the Google Sheet
- Create a Google Sheet (e.g. **"C+B Content"**).
- Add a tab named **Content**.
- Paste the CSV from `data/cnb-homepage-content-table.csv`.
- Header row must be:
  `section, field, value, link, notes`

## 2) Publish the CSV
Google Sheets → **File → Share → Publish to web**

- **Link**: `Content` sheet
- **Format**: `Comma-separated values (.csv)`

Copy the published CSV URL. It looks like:
```
https://docs.google.com/spreadsheets/d/e/<PUBLISHED_ID>/pub?output=csv
```

## 3) Squarespace header injection (set CSV URL)
```html
<script>
  window.CNB_CONTENT_URL = "PASTE THE CSV URL HERE";
</script>
```

## 4) Squarespace footer injection (no SHA updates)
```html
<script>
  (function () {
    var v = Date.now();
    var base = "https://cdn.jsdelivr.net/gh/scampbe3/CNB@main";
    var mount = document.querySelector("[data-cnb-home-root]");
    if (mount) {
      mount.dataset.cnbSrc = window.CNB_CONTENT_URL || (base + "/data/cnb-homepage.json");
      mount.dataset.cnbAssets = base;
    }
    window.CNB_HOME_JSON_URL = base + "/data/cnb-homepage.json";
    window.CNB_HOME_FALLBACK_URL = base + "/data/cnb-homepage.json";
    window.CNB_HOME_ASSET_BASE = base;

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = base + "/css/cnb-homepage.css?v=" + v;
    document.head.appendChild(link);

    ["ai-concierge.js", "cnb-homepage.js"].forEach(function (file) {
      var s = document.createElement("script");
      s.defer = true;
      s.src = base + "/js/" + file + "?v=" + v;
      document.head.appendChild(s);
    });
  })();
</script>
```

## 5) Validate
After a hard refresh:
```
window.CNB_LAST_CONTENT_SOURCE        // should be "csv"
window.CNB_LAST_CONTENT_DATA?.sections?.[0]?.title
```

