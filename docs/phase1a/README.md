# C+B Phase 1A Content Release

## Status

Prepared and locally tested in the isolated `implementation/cnb-phase1a-content` branch. **Not deployed.** The production `main` branch, live Google Sheet, Squarespace pages, existing CSS, loader, renderer, and original working checkout have not been edited.

Authenticated browser access was unavailable in this run. Local preview and public connection checks do not substitute for applying and verifying the live changes.

## Backup

- GitHub: `backup/cnb-before-phase1a-2026-09-12`.
- Verified original production commit: `ffc1fd52395bb17821c24ecce35164f21f2e4c4e`.
- Full local mirror: `D:\CNB\backups\cnb-before-phase1a-2026-09-12.git`, checked with `git fsck --full`.
- Isolated working checkout: `D:\CNB\implementation-phase1a`.
- Google Sheet and Squarespace backups were created by Stephen before this work.

## Content Mapping

| Brief content | Existing or proposed page | Sheet tab | Treatment |
| --- | --- | --- | --- |
| Home | `/new-page-test-3` | `Content` | Final hero, seven experience entries, three testimonials and four destination sections. Does not replace `/`. |
| Consulting | `/work-with-amanda` | `work-with-amanda` | Final copy, eight engagements and consulting CV. Existing section IDs/layouts retained; additional engagements use existing custom section layouts. |
| Speaking & Education | `/speaking-education` (new) | `speaking-education` (new) | Philosophy, topics, three testimonials, education CV and teaching philosophy PDF. |
| Library | `/learn` | `Learn` | Final introduction, topic labels and clearly marked resource-search preview. Actual resource search is not implemented in this content-only pass. |
| The Blind Dinner | `/blind-dinners` | `blind-dinners` | Final copy and all 16 dinner photos. Additional galleries use existing layouts in short groups for mobile reveal compatibility. |
| The Decision Room | `/membership` | `Membership` | Final public membership copy and artwork. Inquiry button uses Amanda's existing email address, not a new paid enrollment flow. |
| Member gate placeholder | `/member-home` (new) | `member-home` (new) | Explicit public preview/coming-soon notice, inquiry link and Library link. No credential collection, private records, working member search, profiles or saved resources. |

About, Stories, both application pages, both thank-you pages, existing join/login behavior and existing navigation settings are unchanged. Content superseded by the brief is replaced or hidden through existing Sheet fields, not deleted from unrelated pages. The staging notice text in Library and the member preview is implementation copy, not supplied client copy.

The approved Leon Wiles wording is used as final. The engineering sentence ends with `build solutions that last.` Logos and alternate photos not assigned a location in the brief were not arbitrarily inserted.

## Image Handling

`image-manifest.json` records source, old slot, output, dimensions, byte size and checksums. All 61 extracted files were verified byte-for-byte against `D:\CNB\finals.zip`.

There are 47 optimized output assets, including repeated photos used in different contexts. The 16 actual replacement slots retain their old image files' exact pixel width and height. Existing assets are not overwritten. New slots use web-sized images. Output is WebP with one AVIF for detailed membership artwork; cumulative output is about 11.2 MB versus about 151.6 MB for the corresponding source uses.

Wide photos placed in existing tall slots use neutral padding to preserve the full photograph, not stretching. Two portrait hero replacements use a fill crop. This is the default pending Stephen's crop preference. A few very large legacy canvases retain their pixel dimensions with web-scale detail rather than print-scale camera detail.

## Sheet Safety

- `baseline.json` is a read-only snapshot of all 11 live tabs plus their original GitHub fallback content.
- `sheet-patch.json` describes individual C/D/E changes by existing section/field identity, plus appended rows. Existing A/B identities and row order are retained.
- Existing tab IDs, published source URLs, page keys and the five columns `section,field,value,link,notes` are unchanged.
- `sheet-apply-packaged.gs` is the compact version 2 updater for a **new temporary standalone Apps Script project**, never a replacement for the existing C+B Tools script. It normalizes checkbox booleans, preserves checkbox types, performs bulk reads, and downloads its immutable patch from commit `57dedcf`.
- `cnbPhase1aPreview()` performs no writes. It rejects changed target values, duplicate identities and formulas in target cells. Unrelated new edits are left alone.
- `cnbPhase1aPrepareNewPages()` prepares only the two new tabs and reports their real GIDs and mount snippets. Existing-page content must not be applied until those new pages are connected and verified.
- `cnbPhase1aApply()` writes only approved target cells and appends new rows. Existing formatting, row heights, notes, validations and schema are not reformatted. New rows inherit existing formatting where possible. Reapplying the same patch is a no-op.
- Script locks cannot prevent human edits. Keep the Sheet idle during application; every target is checked again immediately before writing. A mid-run conflict stops the remaining writes and must be reviewed, not blindly retried.

CSV mirrors are **reference snapshots, not instructions to replace entire live tabs**. Wholesale CSV import would discard formatting and intervening edits. The two new tabs also need to be registered in the current C+B Tools configuration after inspecting its live version; that configuration was not replaced from an old local copy.

## Remaining Deployment

1. Establish authenticated access to the current Sheet and Squarespace admin. Inspect the live C+B Tools script before making additive changes for the two new tabs.
2. Release only the new versioned images, downloadable PDFs and new-page fallback files first (prepared separately in commit `cef8baa`). Verify public asset URLs. Do not merge the entire content branch early: the live loader tracks `main`.
3. Preview the patch, prepare the two new tabs, and verify that their published CSV endpoints work with the returned GIDs. Register the new tabs with the existing CMS tools without replacing their configuration.
4. Add the two Squarespace pages with matching slugs and the exact generated `data-cnb-home-root`, `data-cnb-page`, `data-cnb-src` mount format. Keep the shared loader/injection unchanged. Verify both pages before enabling homepage links to them.
5. With the Sheet idle, rerun preflight and apply the targeted content patch. Then release the matching existing-page JSON fallbacks. Check the short coordinated transition; do not leave old Sheet data mixed with new fallback content.
6. Verify all destination links and three downloads, actual live desktop/mobile layout, CSV/GViz data, the fallback path, and the non-authenticating member placeholder. Check About, Stories, applications and thank-you pages for regressions.

Do not activate paid enrollment, expose private information, rename current routes, publish a new root homepage, or treat the placeholder as access control. Full authentication, member profiles/search, saved resources and Library resource search remain later implementation work.

## Verification And Preview

`qa-report.json`: seven staged pages tested at 1440px and 390px, no runtime errors, no broken images or horizontal overflow, matching CSV/fallback text and section ordering. All replacement dimensions and unchanged layout code are asserted. `live-contract-report.json`: all 11 actual page-to-Sheet connections verified read-only, with no Sheet changes since the baseline at verification time.

From the isolated checkout:

```powershell
node scripts/phase1a/preview.mjs
# Open http://127.0.0.1:4178
node scripts/phase1a/test.mjs
node scripts/phase1a/test-sheet.mjs
node scripts/phase1a/verify-live.mjs
```

Screenshots are in `docs/phase1a/qa/` locally and excluded from Git. The build uses local tooling (`sharp` under `D:\CNB\phase1a-tools`, Playwright in the parent workspace); it adds no runtime dependency to the website. Regenerate content with `node scripts/phase1a/build.mjs`, then package the Sheet helper with `node scripts/phase1a/package.mjs` and rerun tests.
