# C+B Phase 1A Manual Deployment Kit

This folder contains the items needed for the remaining Google Sheets and Squarespace work. It does **not** require manually uploading the 47 optimized images or three PDFs to Squarespace. Those files are already committed on the GitHub implementation branch and must be released to GitHub first so the existing site loader can find them.

## Current Safety State

- Production `main` now contains the asset-only release `cef8baa`; the optimized images, PDFs and two new-page fallbacks are available.
- The live `Content` tab is partially updated through row 84. Other existing content tabs remain at the saved baseline.
- The `speaking-education` and `member-home` tabs contain their complete prepared rows.
- The two matching Squarespace pages and Code Blocks are present and their page keys/GIDs have been verified.
- GitHub backup branch: `backup/cnb-before-phase1a-2026-09-12`.
- Tested implementation branch: `implementation/cnb-phase1a-content`.
- Local preview: `http://127.0.0.1:4178` while the preview process is running.

## Files You Actually Use

### Google Sheets

Use `GOOGLE-SHEETS/sheet-apply-v3-resume.gs` in the **same temporary standalone Apps Script project**. Replace all of the previous updater code; do not paste it over the existing C+B Tools script attached to the Sheet. Version 3 retains the checkbox fix and clears inherited dropdown validation before appending custom section rows.

The script downloads the tested, immutable content patch from GitHub and performs the guarded update. It uses the existing five columns exactly as they are:

`section | field | value | link | notes`

It does not import or replace entire tabs. It checks the current target values before changing them, refuses to overwrite conflicting edits or formulas, leaves unrelated edits alone, preserves the existing section/field identifiers, retains checkbox data types, and appends new rows without reformatting existing rows.

The downloaded `C + B Content - Content.csv` was checked against the saved baseline: all 82 rows match exactly, with the expected five columns and no duplicate section/field identities. A Google CSV download contains only the selected `Content` tab, not every workbook tab, so the preview still safely checks the other affected tabs online.

Because the two new tabs and Squarespace pages are already prepared, resume with:

1. `cnbPhase1aPreview()`
2. On the first run, Google will ask you to authorize access to the workbook and the commit-pinned patch URL. Select **Review permissions**, choose the account that owns or can edit the C+B Sheet, and allow the requested access. If Google shows an unverified-app screen for your own new script, open **Advanced** and continue to that project.
3. Read the execution log. This first function makes no changes. A successful run ends with `PREVIEW PASSED. Nothing was written.`
4. Keep the Sheet idle and run `cnbPhase1aApply()`.

Do **not** run `cnbPhase1aPrepareNewPages()` again. The `speaking-education` tab (`gid=563353691`) and `member-home` tab (`gid=455000318`) already contain their complete data, and their Squarespace Code Blocks have been verified.

The previous application stopped during the `Content` tab: existing Content cells were updated and `Hero / Content Mode / Flexible` was appended at row 84. Version 3 recognizes those completed changes and resumes at row 85 without duplicating row 84.

Do not use the CSV files as import files. They are included under `REFERENCE-ONLY` only so the final proposed rows can be inspected easily. Importing a whole CSV could destroy formatting or overwrite newer Sheet work.

### Squarespace

These two pages have already been created under **Not Linked**:

- Navigation title: `Speaking & Education`; URL slug: `speaking-education`
- Navigation title: `Member Home`; URL slug: `member-home`

No further Squarespace change is needed to resume the Sheet update. The saved snippets remain available for reference.

The verified GIDs are `563353691` for `speaking-education` and `455000318` for `member-home`.

The `member-home` page is only a front-end preview. Leave it under Not Linked. It does not authenticate visitors, collect credentials, expose profiles, or grant access to private content.

Do not change the existing Code Blocks on the other Squarespace pages. Their current page keys, GIDs and mount format have already been verified.

## GitHub Release Order

The implementation is split into two commits so the assets can become publicly available before the Sheet begins referring to them:

1. Completed: release asset commit `cef8baa` and verify the public assets.
2. Completed: prepare the two new Sheet tabs and Squarespace Code Blocks.
3. Current: resume the guarded Sheet update with `sheet-apply-v3-resume.gs`.
4. Remaining after live verification: release the matching updated fallback content.

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
