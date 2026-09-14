# C+B Member Portal

An additive Next.js application for The Decision Room. Squarespace remains the public website. This app supplies the authenticated member area and private operations, with Supabase as the backend and a **separate private Google workbook** for editorial content.

## Start here

- Deployment and acceptance: [Operations](../../docs/member-portal-operations.md).
- Amanda's editorial workflow: [Content guide](../../docs/member-portal-content-guide.md).
- Product scope and implementation differences: [Architecture](../../docs/architecture.md).

The implementation is in `D:\CNB-member-portal`, branch `implementation/member-portal`. The original `D:\CNB` worktree has unrelated unresolved changes and was left intact.

## Local commands

Use Node 24 or newer. On PowerShell, use `npm.cmd` / `npx.cmd` if script execution policy blocks `npm.ps1`.

```powershell
Set-Location D:\CNB-member-portal\apps\member-portal
npm.cmd ci
npm.cmd run check
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run dev
```

The app listens on `http://127.0.0.1:4180`. Without service configuration, it shows an honest setup notice rather than an unsecured demo. Set local service credentials in the ignored `.env.local`; `.env.example` lists the required settings. Do not use production credentials in a preview deployment.

### View with synthetic member data

For a local visual review without Supabase credentials, run:

```powershell
npm.cmd run dev:demo
```

Open `http://127.0.0.1:4190/login`. Use `member@example.test` with password `fixture-password-123`, or `admin@example.test` with the same password to review administration. The demo includes nine entirely fictional directory profiles, five conversations, replies, tags, saves and appreciations. The launcher reuses the test-only service in `tests/browser`, binds both processes to loopback, and contains no production authentication bypass. Data resets whenever the demo stops.

## What's implemented

- Invitation/password authentication, verified onboarding, server-side member/admin authorization, reset and session controls.
- Member Home, editable profiles, image uploads, opt-in directory and multi-category search.
- Public/member Library, full-text search, resource-type filters, private PDF delivery, saved collections.
- Advisory boards, individual dinner invitations, private event details, RSVP capacity/waitlist handling and calendar downloads.
- Named conversation authors, authored conversations on profiles, nested replies, private saves, aggregate appreciations, own-contribution editing/removal, reports and moderation; mediated introduction requests.
- Member administration, private file uploads, event operations, audit records and queued transactional email.
- Private Sheets import, validation/preview, atomic publication, archival and transactional rollback; workbook templates and Apps Script helper.
- Seven-tab section CMS with add/duplicate/order/archive tools, six-page visual composition, approved themes, private image library and administrator-only previews.
- Immediate event-email attempts, one daily sweep, rolling allowance and explicit delivery-failure review, without a five-minute cron.

## Verification boundaries

`npm test` applies the real migration SQL to PGlite PostgreSQL with test Auth/Storage schemas and runs allow/deny tests. This verifies SQL constraints, policies and functions, not the hosted Supabase Auth service.

Playwright runs the real Next.js UI and server actions against an isolated HTTP fixture on loopback. It verifies desktop/mobile flows, navigation, forms, bookmarks, RSVP and automated accessibility checks. Its simulated Auth provider is **test-only**; nothing in the app enables fixture authentication. No actual invitation emails are sent by these tests.

Hosted invitation/reset emails, Storage signed URLs, Google permissions, production DNS and real concurrent network traffic require the staging acceptance pass in the operations guide. Credentials for those services were not available during implementation.

## No automatic public-site cutover

The only prepared public-renderer change makes external portal `/login` URLs bypass Squarespace's account-modal interception. Navigation URLs, public content and legacy pricing plans remain unchanged. Do not redirect `/member-home` or switch live login links before acceptance.
