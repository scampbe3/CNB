# C+B Phase 1A Manual Deployment Kit

This folder contains the items needed for the remaining Google Sheets and Squarespace work. It does **not** require manually uploading the 47 optimized images or three PDFs to Squarespace. Those files are already committed on the GitHub implementation branch and must be released to GitHub first so the existing site loader can find them.

## Current Safety State

- Production `main` has not changed.
- The live Google Sheet has not changed.
- Squarespace has not changed.
- GitHub backup branch: `backup/cnb-before-phase1a-2026-09-12`.
- Tested implementation branch: `implementation/cnb-phase1a-content`.
- Local preview: `http://127.0.0.1:4178` while the preview process is running.

## Files You Actually Use

### Google Sheets

Use `GOOGLE-SHEETS/sheet-apply-packaged.gs` in a **new temporary standalone Apps Script project**. Do not paste it over the existing C+B Tools script attached to the Sheet.

The script contains the complete, guarded content update. It uses the existing five columns exactly as they are:

`section | field | value | link | notes`

It does not import or replace entire tabs. It checks the current target values before changing them, refuses to overwrite conflicting edits or formulas, leaves unrelated edits alone, preserves the existing section/field identifiers, and appends new rows without reformatting existing rows.

Run these functions in order:

1. `cnbPhase1aPreview()`
2. Read the execution log. This first function makes no changes.
3. `cnbPhase1aPrepareNewPages()`
4. Read the execution log and record the two new GIDs and generated mount snippets for `speaking-education` and `member-home`.
5. Complete and verify the two Squarespace pages described below.
6. Keep the Sheet idle, rerun `cnbPhase1aPreview()`, then run `cnbPhase1aApply()`.

Do not use the CSV files as import files. They are included under `REFERENCE-ONLY` only so the final proposed rows can be inspected easily. Importing a whole CSV could destroy formatting or overwrite newer Sheet work.

### Squarespace

Create two pages under **Not Linked**:

- Navigation title: `Speaking & Education`; URL slug: `speaking-education`
- Navigation title: `Member Home`; URL slug: `member-home`

For each page, add one Code Block. Open `SQUARESPACE/speaking-education-code-block.html` or `SQUARESPACE/member-home-code-block.html`, replace only `REPLACE_WITH_GID`, then paste the complete snippet into the page's Code Block.

The GIDs are produced in the execution log by `cnbPhase1aPrepareNewPages()`. Do not use a tab name in place of a GID and do not alter the published workbook URL.

The `member-home` page is only a front-end preview. Leave it under Not Linked. It does not authenticate visitors, collect credentials, expose profiles, or grant access to private content.

Do not change the existing Code Blocks on the other Squarespace pages. Their current page keys, GIDs and mount format have already been verified.

## GitHub Release Order

The implementation is split into two commits so the assets can become publicly available before the Sheet begins referring to them:

1. Release commit `cef8baa` first. It contains the optimized images, PDFs, and fallback files for the two new pages.
2. Verify that the public asset URLs work and complete the two new Sheet tabs and Squarespace Code Blocks.
3. Apply the guarded Sheet update.
4. Release commit `a5f8203` for the updated fallback content and deployment records.

The site loader tracks GitHub `main`; merging the entire implementation branch before coordinating the Sheet update can briefly combine new fallback content with old Sheet content. Use the order above rather than uploading GitHub files manually one by one.

## Existing Pages Updated Through The Sheet

The guarded Sheet script updates these existing pages without requiring Squarespace edits:

| Live page | Sheet tab |
| --- | --- |
| `/new-page-test-3` | `Content` |
| `/work-with-amanda` | `work-with-amanda` |
| `/learn` | `Learn` |
| `/blind-dinners` | `blind-dinners` |
| `/membership` | `Membership` |

About, Stories, the two application pages, the two thank-you pages, Join, navigation and existing shared code remain unchanged.

## Final Checks

After deployment, check all seven updated/new pages on desktop and mobile. Test both new Code Blocks, all destination buttons, and the three PDF downloads. Confirm that the member page still says it is a public preview and contains no login or member-data form.

If `cnbPhase1aPreview()` reports a conflict, stop. Do not edit the packaged script or replace a Sheet tab. The conflict means one of the intended target cells changed after the saved baseline and needs a deliberate comparison.
