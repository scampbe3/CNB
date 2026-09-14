# Editing The Decision Room

## The two places you work

Keep using the current public C+B workbook for Squarespace pages. Use the **private portal workbook** for member editorial content. Both use familiar `section,field,value,link,notes` rows. The private workbook must never be published to the web.

Use portal Administration for people, invitations, private files, meeting links, private dinner addresses, RSVPs, moderation and introductions. These are not spreadsheet content.

## Publish safely

1. Edit values in the private workbook. Keep all seven tabs and their column headers.
2. Choose **C+B Portal > Preview changes**. The portal checks the complete workbook and reports counts plus removals.
3. Correct any errors, then choose **Publish changes**. Nothing changes for members until publication succeeds.
4. Check the portal. Previous publications are listed under **Administration > sheet publishing**. Restore a prior version if needed, giving a reason; update the workbook to match afterward.

Missing resources/events are archived rather than deleted. Prefer changing `Status` to `Archived` instead of removing rows. Existing saved items and RSVPs keep their permanent IDs. Do not empty a whole populated catalog to remove content.

## Member Home and portal copy

`member-home` supports these current keys:

| Section | Fields |
| --- | --- |
| `hero` | `Note` (eyebrow), `Title`, `Subhead`, optional public HTTPS `Image`, `Image Alt` |
| `the-library` | `Title`, `Paragraph 1`, `Button 1` label |
| `in-the-room` | `Title`, `Paragraph 1`, `Button 1` label |

`Portal Settings` supports `Title` and `Subhead` for `library`, `directory` and `community`. `community / Guidelines URL` must point to the approved public HTTPS community guidelines before member posting opens. The URL is shown to members. A blank value keeps posting closed.

Routes, access rules and application controls cannot be changed from these fields. `link` values on Member Home buttons document their destination but do not override the secured application routes. Use the new Page Sections tab for layout and theme changes; arbitrary public-renderer rows are not supported.

## Page Sections: layout, images and new sections

This tab controls the six main member pages: `home`, `library`, `directory`, `advisory-boards`, `community` (Discussions), and `dinners`. It does not change the login, account, profile/detail, admin or anonymous Library pages. If a page has no published section records, its original layout remains in use.

The starter template keeps a hero and existing functional sections for every page. Once enabled, its hero copy takes precedence over older Member Home/Portal Settings hero fields. The older fields still supply copy inside retained native sections, and the community guidelines URL still controls posting.

1. Choose **Add page section**. Set Page, Section Type, Title and Body. New sections start as Draft.
2. Select a row in an existing section and choose **Duplicate selected section** to reuse a design. The copy gets a new ID and starts as Draft.
3. Use **Set selected section order**, or edit Display Order. Lower numbers come first within that page. Prefer 10, 20, 30 to leave room between sections. Do not change permanent Section IDs.
4. Choose a Theme: `light`, `lined`, or `black`. Choose Image Position: `left`, `right`, `above`, or `below`. On narrow screens images always follow the section's text.
5. Change Status to Published for inclusion in the proposed revision, then **Open visual page preview**. This requires administrator login and displays published-status rows from the current workbook without saving them. Draft/Archived rows are hidden. Use **Preview changes** to see validation errors before publishing.
6. Publish when satisfied. Archive sections instead of deleting them. You must retain exactly one published hero and the `existing / content` section on non-Home pages so search, RSVP, posting and other member controls are not lost.

Available types: `hero`, `text-image`, `cards` (one to four cards), `cta`, `library-feed`, `event-feed`, `directory-preview`, `discussion-preview`, and `existing`. Text is plain text, not HTML. Buttons need both CTA Label and CTA Link; card buttons use Card 1 Label/Link through Card 4 Label/Link. Links must be portal paths or HTTPS URLs.

`existing` preserves native application controls and layouts. On Home its Data Source is `features`, `events`, or `connections`; other pages use `content`. These blocks can be reordered but do not become arbitrary editable card fields. Add a new editorial block when you need different copy/design. Feed sections query data with the viewing member's permissions; choosing a dinner feed never reveals uninvited dinners. An event feed's Data Source can be `board`, `dinner`, or blank for both.

### Image library

Choose **Open image library**, or visit **Administration > media**. Upload a JPEG, PNG or WebP up to 3 MB and write a short image description. Copy its Image Asset ID into the section; leave Image empty. Uploads are resized without changing their proportions, converted to WebP and stored privately.

The media form edits the description and focal point (0-100 horizontally and vertically). Section Focal X/Y values override those defaults when provided. Choose a smaller vertical value to retain more of the top of a photograph. Changes to media descriptions/focal points take effect immediately, separately from workbook publication and rollback.

Alternatively, Image accepts an approved public HTTPS URL or an existing bundled `/images/name.webp` path; supply Image Alt. External image URLs are public, so never use them for confidential files. Use only one image source. Published sections cannot reference missing/archived uploaded images, and an image in use cannot be archived until its published references are removed. Unarchive an image before restoring a revision that needs it.

## Library Resources

Use **Add Library resource** to create a new record with a permanent UUID. All rows for that record share one `section` key. Never reuse another resource's ID or change an existing ID.

| Field | Meaning |
| --- | --- |
| `Resource ID` | Permanent UUID generated by the helper |
| `Title`, `Summary`, `Body`, `Author` | Plain text; paragraph breaks in Body are preserved, HTML is not rendered |
| `Slug` | Unique lowercase URL name, words separated with hyphens |
| `Type` | `Essay`, `AI Prompt`, `Decision Brief`, `Business Case` |
| `Status` | `Draft`, `Published`, `Archived` |
| `Access` | `Public` or `Member`; choose Member unless intentionally releasing the full resource publicly |
| `Publish Date` | Optional ISO date/time with timezone; future dates stay hidden until that time |
| `Topic 1`, `Topic 2`, etc. | Searchable plain-text topic labels |
| `Display Order` | Nonnegative whole number; smaller values come first |
| `Image` | Optional public HTTPS image URL; descriptive alt text goes in notes |
| `External Link` | Public HTTPS destination in link or value; never use it for private files |
| `File Asset ID` | ID returned after uploading a PDF in Administration; not a Google Drive sharing link |

Example timestamp: `2026-10-01T18:00:00-04:00`. Use Plain Text cell format for timestamps so Sheets does not silently reformat them. A browser download for a Member resource is authorized by the portal; its signed file link lasts 60 seconds. Changing Access to Public makes its body and associated file public.

## Member Taxonomies

Use **Add taxonomy term**. Fields: `Term ID`, `Kind`, `Label`, optional `Parent Term ID`, `Active` (`TRUE`/`FALSE`), `Display Order`.

Allowed kinds: `profession`, `expertise`, `education_group`, `institution`, `sorority`, `military_service`, `topic`. An institution may refer to an education-group ID so group filters find its members. Do not create circular parent links. Use Active FALSE to retire a label while preserving existing profiles.

The supplied labels follow the PDF. Amanda needs to approve the sorority options because the PDF names that filter without supplying the values. Do not invent an affiliation for any member.

## Advisory Boards and Blind Dinner Events

Use **Add advisory board** or **Add dinner**. The tab determines event type. Keep a record in its original tab: changing a dinner into a board requires a new Event ID so private dinner details cannot accidentally become visible to every member.

Required fields: `Event ID`, `Title`, `Starts At`, `Ends At`, `Timezone`, `Capacity`. Supported optional copy: `Description`, `Location Label`, public HTTPS `Image`. `Status` is `Draft`, `Published`, `Cancelled` or `Archived`.

`Starts At` and `Ends At` are complete ISO timestamps with offsets, and the end must follow the start. `Timezone` is an IANA zone such as `America/New_York`; members also see their local time. The helper's sample dates are placeholders and must be replaced with the actual schedule before publication.

Enter the private meeting URL, address/instructions, materials resource ID and individual dinner guest invitations in **Administration > events**. Published boards are for active members. Published dinners are visible only to individually invited active members. RSVP notes are private to that member and administrators.

Capacity is enforced in the database. If a place is full, the member joins the waiting list. When a confirmed guest declines, an eligible waiting member is promoted and queued for email. To cancel a published gathering, set Status to Cancelled and publish rather than deleting it. Already delivered messages cannot be undone by restoring an editorial revision.

## Common errors

- **Missing tab/header:** restore its exact name and `section,field,value,link,notes` header. Nothing was published.
- **Duplicate ID or slug:** keep the old record's ID; use Add for a genuinely new record.
- **Invalid file ID:** upload the PDF in Administration first and use the returned ID. Maximum 3 MB.
- **Invalid date:** set the cell to Plain Text and include the time and timezone offset.
- **Publishing unavailable:** leave the workbook edits in place and contact the operator. The last successfully published portal content remains live.

Never put member email lists, passwords, session tokens, directory records, RSVP notes or confidential conversations into either workbook.
