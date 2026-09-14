# C+B Member Portal Architecture and Implementation Plan

Status: implemented locally; hosted integration and launch acceptance pending

Primary product source: `Website Language.pdf`, pages 7-9

This document defines how to add the Decision Room member system without replacing the current Squarespace website or its Google Sheets content workflow.

## Implementation record (2026-09-14)

The additive portal is implemented in `apps/member-portal` with nine SQL migrations in `supabase/migrations`. Work is isolated in `D:\CNB-member-portal` on `implementation/member-portal`; the original worktree's unrelated changes remain untouched. Hosted setup status is recorded in the operations guide; local implementation is not a claim of completed production launch.

The [application README](../apps/member-portal/README.md), [operations guide](member-portal-operations.md) and [content guide](member-portal-content-guide.md) describe the delivered code and required launch checks. The numbered sections below retain the agreed design baseline; internal table/route/file proposals are not an assertion that each was implemented with that exact name.

Key implementation refinements:

- Portal editorial content comes from a separate **private workbook**, fetched server-side through authenticated Google Sheets API. It is never loaded from public CSV. The public Squarespace workbook and Apps Script remain unchanged.
- The seven-tab private helper adds Add, Duplicate, Order, Archive, visual Preview and Publish actions. Page Sections supports validated designs and themes on six main member pages while preserving native search/member controls. Private editorial uploads use `editorial-images`; authorization and asset-reference checks are enforced server-side and in SQL. Arbitrary HTML/public-renderer rows do not control this app.
- Routes use a server-rendered catch-all page plus explicit private API handlers, not the originally proposed route-group directory tree. Auth uses Supabase's one-time tokens; no duplicate password/token store is maintained.
- Policy consent is in an owner/admin-only table. JWTs must reference a live Auth session. Suspension removes sessions; activation cannot silently revive a suspended session. Directory visibility is member opt-in; admins can hide, not opt someone in.
- Resource topics are an array included in full-text search. Revision snapshots replace the proposed revision-item tables. All actual schema and RLS definitions are in migrations; `lib/types.ts` describes rendered domain models.
- Avatars and resource PDFs use private buckets named `member-avatars` and `member-resources`. Uploads are limited to 3 MB for the Vercel request path. Private file links expire after 60 seconds.
- Event email is queued with immediate background attempts, a daily sweep and manual administrator processing. A shared lease, rolling allowance, frozen provider payloads and explicit review of uncertain/exhausted attempts replace the five-minute scheduler. No nightly auto-publishing or third-party alerting account is provisioned.
- Community posting stays disabled until an approved guidelines URL is published. Own contributions can be edited/removed while their thread is open. Introduction approval is tracked in the portal; Amanda mediates actual email introductions outside it.
- The member-directory and conversation experience adopts applicable domain patterns proven in the separate philosophy-forum prototype: audience-shaped member/author records, authored-conversation context on profiles, reply trees, private conversation saves, aggregate appreciations, and moderation-aware states. Its Express/SQLite stack, events, identities, images, and copy were intentionally not imported; C+B retains Next.js, Supabase, RLS, its own content authority, and entirely new fictional demo records.
- Deletion/retention policy, approved sorority labels, SMTP/domain/workbook setup, backups and hosted acceptance remain launch gates. There is no automatic deletion or payment system.

Automated verification includes PostgreSQL migration/RLS tests using PGlite with synthetic Auth/Storage schemas, and real Next.js desktop/mobile browser tests against a test-only simulated Auth/REST service. This does not replace the required hosted Supabase/Storage/email/Google acceptance pass. See the operations guide for the exact checklist.

## 1. Source hierarchy

Use this order when requirements conflict:

1. `Website Language.pdf`, pages 7-9, for current membership, Member Home, directory, profile, and saved-resource requirements.
2. Current client-approved page behavior and content in the production Google workbook.
3. `implementation-phase1a/assets/docs/WIP CnB Navigation & Website Language.docx.md` only for implementation details the current PDF does not address.
4. Existing code and preview content as implementation context, not product authority.

The current PDF supersedes older statements that profiles and saved resources are out of scope. It explicitly specifies editable member profiles and a saved Library collection. The older email/password-only guidance remains a reasonable default because the current PDF does not define an authentication method.

`finals.zip` supplies approved visual assets. It is not a software behavior specification.

## 2. Goals

- Preserve the current Squarespace public site, routes, renderer, Google Sheet tabs, and GitHub/jsDelivr asset workflow.
- Add a secure, branded member portal at `members.cupcakesandbroccoli.com`.
- Give Amanda a working login and a manageable invitation-based membership process.
- Implement Member Home, the Library, member search, member profiles, and saved resources exactly as described in the current PDF.
- Provide substantive delivery surfaces for monthly advisory boards, private discussions, curated introductions, and invitation-only dinners.
- Preserve Google Sheets as Amanda's editorial CMS wherever the data is safe and appropriate for spreadsheet editing.
- Keep sensitive, member-owned, and operational data out of public Sheets and public GitHub files.
- Make all content publication recoverable, validated, and observable.

## 3. Non-goals unless separately approved

- Replacing Squarespace as the public website platform.
- Rebuilding existing public C+B pages in the member application.
- Public self-service membership signup.
- Paid checkout, pricing tiers, billing, or subscription reconciliation. The current PDF provides no pricing or billing rules.
- Social login.
- Member-to-member direct messaging.
- Automated introduction matching.
- AI concierge or persisted AI conversations.
- Resource download analytics or personalized business analytics.
- Allowing Sheets or repository JSON to contain private member data.

## 4. Decided architecture

```text
cupcakesandbroccoli.com
Squarespace public website
  - Existing C+B renderer
  - Existing Google Sheet page content
  - Public Membership page and inquiry CTA
                 |
                 | Login / accepted invitation
                 v
members.cupcakesandbroccoli.com
Next.js + TypeScript member portal on Vercel
  - Server-rendered authentication boundary
  - Member and admin interfaces
  - C+B visual tokens and components
                 |
                 v
Supabase
  - Auth
  - PostgreSQL
  - Row Level Security
  - Storage
  - Database migrations

Private portal Google workbook (separate from the public site workbook)
  - Portal editorial tabs
  - C+B Tools validation and publish action
                 |
                 v
Authenticated publishing endpoint
  - Read authenticated Google Sheets API
  - Validate
  - Transactionally publish
  - Retain last known good revision
```

Squarespace remains the public front door. The portal is separately hosted because member identity, per-user authorization, profile uploads, bookmarks, invitations, and private records require a backend security boundary that the current public renderer does not provide.

The portal should live in this repository under `apps/member-portal`, but it gets its own package, tests, CI checks, deployment target, and environment variables. Work should begin in a clean Git worktree because the current root worktree contains extensive unrelated changes.

## 5. Squarespace integration boundary

The public site needs only these integration changes after portal acceptance:

- Change the navigation `Login` destination to `https://members.cupcakesandbroccoli.com/login`.
- Keep `/membership` as the public marketing and inquiry page.
- Route `Explore Membership with Amanda` to an inquiry/application path, not directly to account creation.
- Redirect the current `/member-home` preview to the portal after production launch.
- Preserve all other Squarespace mounts and Google Sheet page connections.
- Update `isLoginHref` in `js/cnb-homepage.js` so only same-origin Squarespace login URLs invoke `window.UserAccountApi`. An external portal URL whose pathname is `/login` must not be intercepted.
- Retire or isolate the legacy Decision Room auto-join plan IDs so an old anchor cannot bypass the invitation workflow.

No portal authorization decision may depend on Squarespace DOM state, `window.UserAccountApi`, a hidden page, or a Not Linked route.

## 6. Content ownership

| Data | Authority | Amanda edits it through | Publicly accessible |
| --- | --- | --- | --- |
| Existing public page copy/layout | Existing Google workbook | Current C+B Tools workflow | Yes |
| Member Home labels and editorial copy | Private `member-home` Sheet tab | Google Sheets | No |
| Supported portal editorial labels | Private `Portal Settings` tab | Google Sheets | No |
| Library resource metadata and editorial body | `Library Resources` tab, published into Supabase | Google Sheets | Public rows only |
| Profession/education/sorority taxonomy | `Member Taxonomies` tab, published into Supabase | Google Sheets | Labels may be public |
| Advisory board and dinner editorial details | Event tabs, published into Supabase | Google Sheets | Only explicitly public fields |
| Meeting links and private event instructions | Supabase | Portal admin | No |
| Authentication/passwords/tokens | Supabase Auth | Member auth flows | No |
| Member profile and directory visibility | Supabase | Member profile editor/admin | Active members only |
| Email, status, role, admin notes | Supabase | Portal admin | No |
| Bookmarks | Supabase | Member actions | Owner only |
| Invitations and RSVPs | Supabase | Member/admin actions | Relevant member/admin only |
| Discussions, replies, saves, appreciations and reports | Supabase | Member/admin actions | Conversations for active members; saves owner-only; appreciation counts only |
| Introduction requests | Supabase | Requester/admin | Requester/admin only |
| Audit records | Supabase | System/admin | Admin only |

Google Sheets is an editorial CMS, not an identity store or secure application database.

## 7. Google Sheet portal tabs

Keep the existing five-column convention, `section,field,value,link,notes`, so the current client mental model and C+B Tools sidebar can be extended instead of replaced.

### 7.1 `member-home`

Use the same familiar tab name in the separate private workbook, with its own ID. The implemented field contract is documented in the content guide. Do not repurpose or expose private content in the public website's member-home preview tab.

### 7.2 `Library Resources`

Each resource uses a permanent section key such as `resource-ai-design-style`. Supported fields:

- `Resource ID`: generated UUID; locked after creation.
- `Status`: Draft, Published, or Archived.
- `Access`: Public or Member.
- `Type`: Essay, AI Prompt, Decision Brief, or Business Case.
- `Title`, `Summary`, `Body`, `Author`, `Publish Date`, `Display Order`.
- Repeatable `Topic 1`, `Topic 2`, and later topic rows.
- `Image` with alt text in `notes`.
- `External Link` only for intentionally public destinations.
- `File Asset ID` references a portal-admin upload; the Sheet never contains a private file URL.

### 7.3 `Member Taxonomies`

Each term uses a permanent section key. Supported fields:

- `Term ID`: generated UUID; locked after creation.
- `Kind`: Profession, Expertise, Education Group, Institution, Sorority, or Military Service.
- `Label`, `Parent Term ID`, `Display Order`, and `Active`.

Seed the exact professions, named Ivy League schools, education groups, military academies, and military branches from page 8 of the PDF. Sorority values require a client-approved seed list because the PDF names the filter but does not provide values.

### 7.4 `Advisory Boards`

Supported fields include permanent event ID, status, title, description, complete start/end timestamps, timezone, capacity, image and general location label. Private instructions and meeting URLs are entered only in portal admin.

### 7.5 `Blind Dinner Events`

Use the same event fields plus invitation-only status. Guest lists, private addresses, dietary notes, and RSVP records remain in portal admin.

### 7.6 `Portal Settings`

Use stable sections for navigation labels, announcements, onboarding help, directory empty states, Library empty states, RSVP messages, support email, and footer copy. Authentication and security configuration never comes from the Sheet.

## 8. Sheet publishing workflow

The portal must not directly treat an actively edited Sheet as its database. Publication works as follows:

1. Amanda edits portal tabs using familiar C+B rows and sidebar controls.
2. The private workbook gets its own C+B Portal menu. The existing public Apps Script is not replaced.
3. Preview validates required fields, UUIDs, enums, date/time formats, duplicate slugs, links, parent taxonomy references, image URLs, and relationships without writing production data.
4. Publish calls an authenticated portal endpoint. The signing secret is stored in Apps Script Properties, not cells.
5. The endpoint reads the private workbook through authenticated Sheets API, computes a source hash, validates it again server-side, and publishes a revision transactionally.
6. A single database transaction upserts valid records, archives intentionally removed records, records the revision, and promotes it as current.
7. Any validation or database failure leaves the previous published revision active.
8. The result returned to the Sheet includes revision ID, changed records, warnings, errors, and publication time.
9. Publication is explicit. Nightly reconciliation/external alerting was a planned operational enhancement, not delivered automatic behavior; see the launch monitoring checklist.

Repository JSON remains an emergency fallback for non-sensitive portal shell copy only. Private content and member records never receive a public JSON fallback.

## 9. Application routes

### Public portal routes

- `/login`
- `/forgot-password`
- `/reset-password`
- `/accept-invite`
- `/privacy`
- `/terms`

### Active-member routes

- `/`: Member Home.
- `/library`: searchable Library.
- `/library/[slug]`: authorized resource detail.
- `/saved`: compatibility redirect to Saved from the Library on the member's profile.
- `/directory`: In the Room search and filters.
- `/members/[id]`: safe member profile.
- `/profile/edit`: profile and directory visibility editor.
- `/advisory-boards`: board schedule, RSVP, and materials.
- `/community`: discussion index.
- `/community/[threadId]`: thread and comments.
- `/introductions`: compatibility redirect to introduction-request history in Account.
- `/dinners`: member's dinner invitations and RSVPs.
- `/account`: introduction-request history, profile links, password, sessions, privacy, and account support.

### Active-member navigation

The primary member menu follows the hierarchy in `Website Language.pdf`: Home, The Library, In the Room, Advisory Boards, Discussions, and Dinners. Account is a persistent utility control beside Menu rather than a primary navigation item. Introduction requests live in Account and begin from another member's profile. Saved from the Library lives on the member's own profile. Their former standalone URLs remain compatibility redirects and are not primary navigation items.

### Admin routes

- `/admin/members`
- `/admin/invitations`
- `/admin/profiles`
- `/admin/resources`
- `/admin/events`
- `/admin/discussions`
- `/admin/introductions`
- `/admin/sheet-publishing`
- `/admin/audit`

Every protected route checks both a valid Supabase session and an active membership state on the server. Hiding navigation is not authorization.

## 10. Database model

Use UUID primary keys, `created_at`, `updated_at`, and explicit foreign keys throughout. Use migrations for every schema or policy change.

### Identity and membership

- `auth.users`: Supabase-managed credentials and verified email.
- `member_profiles`: `user_id`, display name, title, company, bio, city, region, country, avatar path, directory visibility, onboarding completion, and timestamps.
- `memberships`: `user_id`, status, role, admitted date, suspended/revoked date, and non-public admin reason.
- Status values: Invited, Active, Suspended, Revoked.
- Role values: Member, Admin.
- `member_invitations`: email, token hash, status, expiry, invited by, accepted by, and timestamps.

Do not use editable JWT user metadata for authorization. Role and membership state remain server-controlled and are checked against the database. Short-lived claims may be used only with an immediate revocation strategy.

### Taxonomy and profiles

- `taxonomy_terms`: kind, label, slug, parent ID, display order, active flag, and Sheet revision.
- `member_taxonomy_terms`: member ID and term ID with a unique pair constraint.
- `profile_audit`: member/admin profile changes required for support and moderation.

### Library

- `resources`: slug, title, summary, body, type, access, author, publish date, status, image, file asset ID, external URL, search vector, and Sheet revision.
- `resource_topics`: resource/term relationship.
- `saved_resources`: member ID, resource ID, and saved timestamp, unique by member/resource.
- `file_assets`: storage path, original name, MIME type, byte size, access, checksum, uploader, and status.

### Events

- `events`: type, title, description, schedule, timezone, capacity, location mode, public location label, private instructions, meeting URL, status, image, and Sheet revision.
- `event_invitations`: event/member pair, invitation state, sent time, and response deadline.
- `event_rsvps`: event/member pair, response, guest count if permitted, dietary note, and timestamps.
- Advisory boards are available to active members according to event visibility.
- Blind Dinner details are available only to individually invited active members.

### Community and introductions

- `discussion_threads`: author, title, body, status, pinned state, and timestamps.
- `discussion_comments`: thread, optional parent response, author, body, status, and timestamps.
- `discussion_saves`: member/thread pairs visible only to their owner.
- `discussion_appreciations`: member/thread pairs visible only to their owner; other members receive aggregate counts.
- `discussion_reports`: reporter, target type/ID, reason, status, and admin notes.
- `introduction_requests`: requester, requested member, context, status, admin notes, and timestamps.

### Publishing and operations

- `cms_revisions`: source tab, source hash, status, validation report, publisher, and timestamps.
- `cms_revision_items`: revision, entity type, entity ID, operation, and before/after checksums.
- `audit_events`: actor, action, target, safe metadata, request ID, and timestamp.

## 11. Row Level Security policy matrix

| Resource | Anonymous | Invited | Active member | Admin |
| --- | --- | --- | --- | --- |
| Own auth session | Auth endpoints only | Own | Own | Own |
| Public resources | Read published | Read published | Read published | Manage |
| Member resources | None | None | Read published | Manage |
| Directory profiles | None | None | Read active and visible safe fields | Manage |
| Own profile | None | Complete invitation flow only | Read/update allowed fields | Manage |
| Other private profile fields | None | None | None | Manage |
| Own bookmarks | None | None | Create/read/delete | Manage for support only |
| Advisory events | None | None | Read eligible; RSVP as self | Manage |
| Dinner details | None | None | Read only when invited; RSVP as self | Manage |
| Discussions | None | None | Read; create; edit own within policy | Moderate |
| Introduction requests | None | None | Create/read own | Manage |
| Audit and admin notes | None | None | None | Read/manage |

Safe RPCs shape directory cards, conversation feeds, conversation details, and replies. They reveal a contribution author's name/avatar only when her directory consent allows it (or to herself/admin), expose appreciation totals without the identities behind them, and never expose another member's saved list. Never select directly from a table containing email, status reasons, or admin notes when rendering member-visible profiles.

## 12. Authentication and account lifecycle

1. A prospective member uses the public `Explore Membership with Amanda` inquiry path.
2. Amanda reviews the inquiry outside the authentication system.
3. An admin enters the approved email and optional name in `/admin/invitations`.
4. The server creates a hashed, single-use, time-limited invitation and sends a branded email.
5. The recipient verifies the email, sets a password, accepts terms/privacy, and completes required profile fields.
6. The account becomes Active only after invitation acceptance and required onboarding.
7. Login returns the member to the originally requested safe portal route or `/`.
8. Password reset invalidates the reset token after use. Members can revoke other sessions from Account.
9. Suspension blocks all member data immediately while retaining records for review.
10. Revocation blocks access and begins the documented retention/deletion workflow.

Rate-limit login, reset, invitation acceptance, discussions, introduction requests, and RSVP mutations. Log security-relevant outcomes without logging passwords, tokens, full request bodies, or private discussion content.

## 13. Feature behavior

### Member Home

- Render the PDF's eyebrow, `Welcome back.`, and decision prompt.
- Treat the decision prompt as static copy until the client specifies what an answer should do and whether it may be stored.
- Provide cards for Library and In the Room.
- Add operational cards for upcoming advisory boards, pending dinner invitations, recent discussions, and introduction-request status only after those modules exist.
- Use Sheet-managed labels and empty states, but database-driven personalized counts.

### Directory

- Search display name, title, company, expertise, education, and normalized location.
- Filter by profession, education, location, sorority, and military service.
- Support multi-select filters, clear-all, result count, pagination, keyboard operation, and shareable query parameters.
- Return only Active profiles with directory visibility enabled.
- Do not display email or provide bulk export to members.

### Profile

- Display the exact PDF content: uploaded photo, name, founder/title and company, expertise, education, location, About, saved Library content, and Edit Profile.
- Members edit only their own allowed fields.
- Expertise and education values use approved taxonomy terms rather than unrestricted public tags.
- About text is plain text or strictly sanitized limited markup.
- Directory participation defaults to a clearly explained opt-in during onboarding.

### Library and saved resources

- Search title, summary, body, author, and topics with PostgreSQL full-text search.
- Filter All, Essays, AI Prompts, Decision Briefs, and Business Cases.
- Enforce Public/Member access at query and file-delivery layers.
- Save and unsave idempotently.
- Preserve bookmarks when editorial titles or slugs change by using immutable UUIDs.
- Archived resources remain identifiable in old bookmarks but cannot expose removed content.
- Private files use short-lived signed URLs generated after authorization.

### Advisory boards and dinners

- Show times in the member's local timezone with the source timezone visible.
- Support RSVP Yes/No and capacity/waitlist behavior.
- Generate calendar files without embedding a private meeting link unless authorized.
- Limit dinner visibility and location details to invited members.
- Send transactional invitation, reminder, update, and cancellation emails.

### Community

- Provide threads and comments, not real-time chat.
- Allow reporting, locking, pinning, hiding, and soft deletion.
- Publish community guidelines before enabling member posting.
- Avoid direct messaging until moderation, blocking, and abuse workflows are separately scoped.

### Curated introductions

- Add `Request an introduction` to eligible profiles.
- Collect a short reason and what the requester hopes to discuss.
- Let Amanda approve, decline, request more information, or mark complete.
- Do not reveal either member's email until Amanda performs the introduction outside the portal or both parties consent to sharing.

## 14. Admin experience

Amanda should not need the Supabase dashboard for routine work. The branded admin interface must provide:

- Member search, invitation, resend, suspension, revocation, and status history.
- Profile review and directory visibility controls.
- Event private details, invitations, RSVP review, and exports.
- Discussion moderation and report resolution.
- Introduction request workflow.
- Private Library file upload and association with Sheet-authored resource records.
- Sheet publication preview, validation failures, revision history, and rollback.
- Audit history and support-safe account diagnostics.

Destructive actions require confirmation. High-impact actions such as revoking membership or rolling back content require a reason recorded in the audit log.

## 15. Storage and media

- Use a private `member-avatars-original` bucket for uploads and a controlled transformed avatar delivery path.
- Restrict avatars to approved image MIME types and a small maximum size.
- Remove image metadata and produce consistent square display derivatives.
- Use a private `member-resources` bucket for protected PDFs/files.
- Validate MIME type, extension, checksum, and size server-side.
- Public editorial images may continue using the established GitHub/Cloudinary image workflow.
- Never store credentials, tokens, or private URLs in image metadata or Sheet notes.

## 16. Repository structure

```text
apps/member-portal/
  app/
    (public)/
    (member)/
    admin/
    api/
  components/
  lib/
    auth/
    cms/
    data/
    validation/
  styles/
  tests/
supabase/
  migrations/
  seed/
  tests/
scripts/member-portal/
  import-existing-members.*
  verify-sheet-content.*
docs/
  architecture.md
  member-portal-operations.md
  member-portal-content-guide.md
```

Use Zod or an equivalent runtime schema at every Sheet, form, and privileged API boundary. Generate TypeScript database types from the migrated schema. Keep server-only modules structurally separate so service credentials cannot enter browser bundles.

## 17. Environments and delivery

- Local: local Supabase stack and fixture email delivery.
- Staging: separate Supabase project, staging portal URL, test Sheet tabs or a copied workbook, and synthetic members only.
- Production: production Supabase, production portal domain, production email provider, and production workbook tabs.
- Never point a preview deployment at the production database.
- Protect staging with access controls and robots exclusion.
- Require migration, RLS, type, unit, integration, accessibility, and Playwright checks before production deployment.

Environment secrets include Supabase server credentials, email-provider key, Sheet publish secret, and monitoring credentials. Store them in deployment and CI secret stores only. The Supabase publishable browser key is not a secret, but it is safe only with tested RLS and least-privilege grants.

## 18. Implementation slices

Each slice should be independently reviewable and deployable to staging.

1. Architecture, clean worktree, portal scaffold, C+B visual shell, CI, staging deployment, and health checks.
2. Database migrations, seed taxonomy, RLS policies, policy tests, and typed data access.
3. Invitation, login, logout, reset, protected routing, active-membership checks, and transactional email.
4. Profile onboarding/editing, avatar processing, visibility consent, admin member controls, and profile tests.
5. Directory search RPC/view, filters, pagination, safe profile page, responsive UI, and accessibility tests.
6. Library schema, Sheet tab/tooling, transactional publisher, search, access control, resource pages, and admin file upload.
7. Bookmarks, the profile's Saved from the Library section, saved-resource search/type filters, archived-resource behavior, and cross-member isolation tests.
8. Advisory boards and dinners, invitations, RSVP/capacity, private details, calendar export, and notifications.
9. Community threads/comments/reporting/moderation and curated-introduction workflow.
10. Squarespace link integration, `/member-home` cutover, legacy login/autojoin isolation, migration rehearsal, acceptance testing, and production launch.

Do not combine authentication, RLS, and every feature into one release. Complete and attack-test the security foundation before importing real member data.

## 19. Test plan

### Required automated coverage

- Database allow/deny tests for Anonymous, Invited, Active, Suspended, Revoked, and Admin contexts.
- Cross-member read/update/delete attacks against profiles, bookmarks, invitations, RSVPs, reports, and introductions.
- Direct private file URL and expired signed URL tests.
- Sheet parser tests for valid rows, duplicate IDs/slugs, invalid enums/dates/links, missing parents, removals, archives, and rollback.
- Invitation expiry/replay, reset expiry/replay, open-redirect prevention, and session revocation.
- Directory filter combinations and safe result fields.
- Library access, full-text search, save/unsave idempotency, and archived bookmarks.
- Event eligibility, dinner invitation boundaries, capacity races, and RSVP changes.
- Discussion ownership, sanitization, reporting, locking, and moderation.
- Keyboard navigation, focus management, semantic labels, reduced motion, responsive breakpoints, and contrast.

### Required manual acceptance roles

- Prospective visitor.
- Invited but incomplete member.
- Active member with a complete profile.
- Active member hidden from the directory.
- Suspended member with an existing session.
- Amanda administrator.

## 20. Migration and cutover

1. Keep the existing `/member-home` preview unchanged during development.
2. Inventory any existing Squarespace customer/member records and pricing plans without assuming they are authoritative portal memberships.
3. Obtain Amanda's approved initial roster and directory consent status.
4. Normalize and deduplicate email addresses in an offline import report.
5. Import invitation records only; never import or generate passwords.
6. Send staging invitations to internal test accounts and complete acceptance testing.
7. Back up the workbook, repository baseline, database, and current Squarespace navigation settings.
8. Deploy production with no real members, test production routing and authorization, then import approved invitations.
9. Update Squarespace Login and membership links.
10. Redirect `/member-home` only after the portal passes production smoke tests.
11. Send invitations in small batches and monitor delivery, acceptance, login failures, and authorization denials.

Rollback consists of restoring the prior Squarespace links/redirects, disabling portal invitations, and preserving the database for diagnosis. Public site availability must not depend on portal availability.

## 21. Default decisions and remaining confirmation points

Implementation can begin with these defaults:

- Email/password authentication, no social providers.
- Invitation-only admission; no public account creation.
- No payment processing until current pricing and billing rules are approved.
- Directory visibility is opt-in and clearly explained.
- Members can see only safe fields of other visible active members.
- Internal thread/comment community, no private messages.
- Introductions are manually mediated by Amanda.
- Advisory boards are active-member events; dinners require individual invitations.
- Sheet edits use preview/publish and transactional activation rather than becoming live mid-edit.
- Amanda uses the portal admin for people/private operations and Sheets for editorial content.

The following do not block the foundation but must be resolved before their feature is activated:

- Approved sorority taxonomy.
- Whether education and profession allow member-requested custom values.
- Required versus optional profile fields.
- Retention period after membership revocation or account deletion.
- Community guidelines and moderation response policy.
- RSVP cancellation deadline, waitlist behavior, and guest policy.
- Whether any active Squarespace pricing plan remains commercially relevant.
- Final production sender address for authentication and event email.

## 22. Definition of done

The member portal is ready when:

- Anonymous, invited, suspended, and revoked users cannot retrieve protected member data or files.
- Approved members can accept an invitation, log in, reset a password, log out, and safely resume an intended route.
- Members can complete/edit the specified profile, control visibility, search the directory by every PDF-defined category, and view safe profiles.
- The Library supports public/member authorization, search, all required types, resource details, saving, unsaving, and the Saved collection.
- Advisory boards, confidential discussions, curated introductions, and invitation-only dinners have functioning member and admin workflows rather than marketing-only placeholders.
- Amanda can edit editorial portal content in Google Sheets, preview validation, publish atomically, diagnose failures, and roll back without developer or database access.
- Amanda can perform routine private operations through the portal admin without using Sheets or Supabase directly.
- Security-policy, integration, end-to-end, mobile, desktop, and accessibility tests pass.
- Production monitoring, backups, operational documentation, privacy text, and rollback procedures are in place.

## 23. Primary platform references

- Squarespace Member Sites: `https://support.squarespace.com/hc/en-us/articles/360050832631-Member-Sites`
- Squarespace member management: `https://support.squarespace.com/hc/en-us/articles/360050832691-Managing-members`
- Squarespace Contacts API: `https://developers.squarespace.com/commerce-apis/contacts-overview`
- Supabase Row Level Security: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Supabase data security: `https://supabase.com/docs/guides/database/secure-data`
- Supabase Storage access control: `https://supabase.com/docs/guides/storage/security/access-control`
