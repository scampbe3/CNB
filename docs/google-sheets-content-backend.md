# Google Sheets Content Backend (C+B)

This sets up a **no‑script workflow for the client**:

1. Client edits a Google Sheet.
2. A Google Apps Script endpoint converts the sheet into the live JSON the site needs.
3. The site fetches that JSON on load.

## 1) Create the Google Sheet

- Create a new Google Sheet named something like **"C+B Content"**.
- Create a tab named **Content**.
- Paste the CSV from `data/cnb-homepage-content-table.csv` into that tab.
- Make sure the header row is:
  `section, field, value, link, notes`

## 2) Add the Apps Script (JSON endpoint)

In the Google Sheet:
`Extensions → Apps Script` and replace with:

```javascript
const BASE_JSON_URL = "https://cdn.jsdelivr.net/gh/scampbe3/CNB@main/data/cnb-homepage.json";

const SECTION_MAP = {
  "Hero": "hero",
  "What This Is": "what",
  "AI Concierge": "ai",
  "Learn": "learn",
  "Work With Amanda": "work",
  "Blind Dinners": "dinners",
  "Membership": "membership",
  "Closing": "closing"
};

function doGet(e) {
  const base = JSON.parse(UrlFetchApp.fetch(BASE_JSON_URL).getContentText());
  const sheet = SpreadsheetApp.getActive().getSheetByName("Content");
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Missing Content sheet" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(h => String(h).trim());
  const rows = values
    .filter(row => row.some(cell => String(cell).trim() !== ""))
    .map(row => {
      const obj = {};
      headers.forEach((key, i) => {
        obj[key] = row[i] == null ? "" : String(row[i]);
      });
      return obj;
    });

  applyRows(base, rows);

  const output = JSON.stringify(base);
  const callback = e && e.parameter && e.parameter.callback ? e.parameter.callback : "";
  if (callback) {
    return ContentService.createTextOutput(`${callback}(${output});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

function applyRows(page, rows) {
  const byId = {};
  (page.sections || []).forEach(section => {
    if (section.id) byId[section.id] = section;
  });

  const updates = {};

  rows.forEach(row => {
    const sectionName = row.section || "";
    const field = row.field || "";
    const value = row.value || "";
    const link = row.link || "";
    const notes = row.notes || "";
    if (!sectionName || !field) return;
    const sectionId = SECTION_MAP[sectionName];
    if (!sectionId) return;
    if (!updates[sectionId]) updates[sectionId] = {};
    const bucket = updates[sectionId];

    if (/^Body\\s*\\d+/i.test(field)) {
      const idx = Number(field.replace(/\\D+/g, "")) || 1;
      if (!bucket.body) bucket.body = {};
      bucket.body[idx] = value;
      bucket.hasBody = true;
      return;
    }

    if (/^Prompt\\s*\\d+/i.test(field)) {
      const idx = Number(field.replace(/\\D+/g, "")) || 1;
      if (!bucket.prompts) bucket.prompts = {};
      bucket.prompts[idx] = value;
      bucket.hasPrompts = true;
      return;
    }

    if (/^CTA\\s*\\d*/i.test(field)) {
      const idxMatch = field.match(/\\d+/);
      const idx = idxMatch ? Number(idxMatch[0]) : 1;
      if (!bucket.ctas) bucket.ctas = {};
      bucket.ctas[idx] = { label: value, href: link, notes };
      bucket.hasCtas = true;
      return;
    }

    if (/^Inline\\s*link/i.test(field)) {
      bucket.inlineLink = { label: value, href: link };
      return;
    }

    if (/^Image/i.test(field)) {
      bucket.image = { src: value, alt: notes };
      return;
    }

    if (/^Panel\\s*label/i.test(field)) {
      bucket.panelLabel = value;
      return;
    }

    if (/^Title/i.test(field)) {
      bucket.title = value;
      return;
    }

    if (/^Subhead/i.test(field)) {
      bucket.subhead = value;
      return;
    }

    if (/^Note/i.test(field)) {
      bucket.note = value;
      return;
    }

    if (/^Eyebrow/i.test(field)) {
      bucket.eyebrow = value;
      return;
    }
  });

  Object.keys(updates).forEach(sectionId => {
    const section = byId[sectionId];
    if (!section) return;
    const data = updates[sectionId];

    ["title", "subhead", "note", "eyebrow", "panelLabel"].forEach(key => {
      if (key in data) section[key] = data[key];
    });

    if (data.inlineLink) section.inlineLink = data.inlineLink;
    if (data.image && data.image.src) {
      section.image = section.image || {};
      section.image.src = data.image.src;
      if (data.image.alt) section.image.alt = data.image.alt;
    }

    if (data.hasBody) {
      const body = Object.keys(data.body || {})
        .sort((a, b) => Number(a) - Number(b))
        .map(k => data.body[k])
        .filter(Boolean);
      section.body = body;
    }

    if (data.hasPrompts) {
      const prompts = Object.keys(data.prompts || {})
        .sort((a, b) => Number(a) - Number(b))
        .map(k => data.prompts[k])
        .filter(Boolean);
      section.prompts = prompts;
    }

    if (data.hasCtas) {
      const ctas = Object.keys(data.ctas || {})
        .sort((a, b) => Number(a) - Number(b))
        .map(k => {
          const cta = data.ctas[k];
          if (!cta || !cta.label) return null;
          const out = { label: cta.label, href: cta.href };
          if ((cta.notes || "").toLowerCase().includes("primary")) out.variant = "primary";
          if ((cta.notes || "").toLowerCase().includes("ghost")) out.variant = "ghost";
          if ((cta.notes || "").toLowerCase().includes("accent")) out.variant = "accent";
          if ((cta.notes || "").toLowerCase().includes("modal")) out.behavior = "modal";
          return out;
        })
        .filter(Boolean);
      section.ctas = ctas;
    }
  });
}
```

Deploy:
- `Deploy → New deployment → Web app`
- Execute as: **Me**
- Who has access: **Anyone**

Copy the Web App URL.

Note: every new deployment creates a **new URL**. If you redeploy, update the Squarespace header script to the new URL.

## 3) Point the site at the endpoint

In Squarespace **Header Code Injection** (above loader):

```html
<script>
  window.CNB_CONTENT_URL = "https://script.google.com/macros/s/AKfycbxewTvBbkHU53sZ3NiQXLt_6ZD37yO3ziJFbOY0BmtShwO57xzilWrG9jgvYomZYuYo/exec";
</script>
```

That’s it. Edits in the sheet go live automatically.
