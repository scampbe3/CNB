# Member Portal Operations

Implementation location: `apps/member-portal`. Product authority: `Website Language.pdf`, pages 7-9. This runbook describes the actual code; it takes precedence over the older planning document's proposed internal file names and fields.

## Deployment status

The application, nine migrations, workbook tools and automated tests are implemented locally. Vercel project `scampbe3s-projects/cnb-member-portal` has been created and linked, with Next.js, Node 24, repository root `apps/member-portal`, `npm ci` and `npm run build` configured. No billing changes were made. No working hosted portal deployment, Supabase project, Google workbook, DNS entry, sender account or real member invitation has been completed by this implementation. Production launch is not complete.

Vercel CLI authentication works as `scampbe3`. Supabase CLI currently lists no organizations or projects. Required remaining connections: the intended Supabase organization/project, private Google workbook and service account, verified sender/SMTP, approved policy URLs, and an authorized test inbox. Never paste secrets in chat; enter them in the provider dashboards or the app's ignored `.env.local` as appropriate. The account/project names can be shared without credentials.

Prepare the seven-template ZIP with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-workbook.ps1` from the app directory (the execution-policy override applies only to this process). Install `scripts/portal-workbook.gs` in a new private workbook under the operator's Google account, reopen it and select **C+B Portal > Import starter ZIP (empty workbook only)**. This is an import tool, not evidence that the online workbook already exists.

## 1. Establish staging

1. Create a separate staging Supabase project and a separate staging Vercel project owned by the client or agreed operator. Use synthetic members only.
2. Apply `supabase/migrations/` in filename order from the repository root. Use the Supabase CLI linked to the staging project; first review `supabase db push --dry-run`, then apply. Run `supabase/seed.sql` once to initialize the PDF taxonomy, or publish the matching taxonomy template. Do not reset a populated remote database.
3. Set Vercel's project root to `apps/member-portal`, framework Next.js, install `npm ci`, build `npm run build`. Use a supported Node runtime (24+). Never reuse production environment variables for preview deployments.
4. Set every required environment variable from `.env.example`. Store the Supabase service role, Google private key, publishing secret, email key and cron secret only in server-side secret settings. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` must be the public key, never the service role key.
5. Configure Auth's Site URL to the exact staging portal origin. Allow only its `/auth/confirm` redirect plus required local development URLs. Disable public signup, anonymous login and unused providers. Require confirmed email, password length 12+, and secure password changes.
6. Configure a verified SMTP sender in Supabase Auth. Apply `supabase/templates/invite.html` and `recovery.html` to the hosted project's Invite and Reset Password templates. Their links use `TokenHash` and the portal confirmation form. The supplied `config.toml` templates apply automatically only to local Supabase, not to hosted projects.
7. Enable Auth password-change notifications and appropriate Auth rate limits/CAPTCHA at the provider. Application rate limits are additional protection, not a replacement for provider-level abuse controls.
8. Configure event-email delivery through Resend with an approved sender/domain. Auth mail uses Supabase SMTP; event mail uses the outbox worker. Configure SPF/DKIM/DMARC and disable link tracking on authentication emails.
9. Set approved `TERMS_URL`, `PRIVACY_URL`, `POLICY_VERSION` and `SUPPORT_EMAIL`. Enrollment remains disabled without policy configuration. Do not substitute invented legal language.

For local Supabase, install Docker and the Supabase CLI, then run `supabase start` at the repository root. Local Auth sends to Inbucket at port 54324. Docker was not available in the implementation environment; the automated database suite uses PGlite instead.

For a zero-configuration visual review, run `npm.cmd run dev:demo` from `apps/member-portal` and sign in at `http://127.0.0.1:4190/login` with `member@example.test` / `fixture-password-123`. This loopback-only fixture includes nine fictional profiles and five seeded conversations with reply, save, and appreciation states. It is not a roster-import mechanism, does not touch Supabase, and resets whenever the process stops. Production and staging receive no fictional members from `supabase/seed.sql`; that file initializes approved taxonomy only.

## 2. Connect the private editorial workbook

1. Create a **new private workbook**, not another tab in the publicly published Squarespace workbook. Sharing is restricted to Amanda, trusted editors and the Google service account as Viewer. Never use Publish to the web or an anonymous CSV export for portal content.
2. Enable Google Sheets API in the client's Google Cloud project and create a dedicated read-only service account. Set its email/key and this workbook's ID in the portal environment. An escaped `\n` private key is accepted.
3. Import the seven templates from `apps/member-portal/cms-templates/` as separate tabs with the exact names, including Page Sections. Keep IDs in the seeded taxonomy consistent with `supabase/seed.sql`. Resource and event tabs intentionally start empty: client content/schedules are not fabricated. The Apps Script menu can import a ZIP of all seven CSV files into an empty workbook; it refuses to overwrite populated tabs. Do not import starter copy over a live workbook.
4. Install `scripts/portal-workbook.gs` in this private workbook's Apps Script project. If an `onOpen` exists, call `cnbPortalMenu()` from it. This helper does not replace the public website's C+B Tools script.
5. Set Apps Script properties `PORTAL_URL` (HTTPS origin) and `SHEET_PUBLISH_SECRET`. Use a random secret of at least 32 characters, matching the portal. Workbook editors with Apps Script access are trusted publishers. Never place credentials in cells.
6. Run C+B Portal > Preview changes. Correct all errors, then publish. Confirm a new revision in `/admin/sheet-publishing` and verify the resulting content. Test rollback before any real member data is admitted.

Preview validates IDs, enums, hierarchy, dates, HTTPS URLs, duplicate slugs and uploaded file references. Publish runs a single transaction; failed publication leaves prior content intact. Missing records are archived, not deleted. Entire previously populated resource/taxonomy catalogs cannot be silently cleared via publish. Rollback restores editorial state only, not member records, RSVP history or already delivered emails.

After rollback, correct the workbook too; otherwise the next intentional publish reapplies its newer content. There is no automatic background publication of unreviewed Sheet edits.

## 3. Bootstrap the first administrator

Run from `apps/member-portal` after SMTP, templates, policy configuration and migrations are ready:

```powershell
npm.cmd run preflight -- --online
npm.cmd run bootstrap-admin -- --email approved-test-admin@example.test
```

The bootstrap defaults to a dry run. Replace the synthetic address with an explicitly authorized test inbox. Only when approved, the additional `--send-invite` flag creates the first admin invitation and sends email. This command refuses if an administrator already exists. It never generates a password or activates membership for the recipient.

The recipient confirms the email link, chooses a password and finishes onboarding. The database requires a verified email, an unexpired admission record and a set password. The role is server-owned; a member cannot promote herself through metadata or profile forms.

If bootstrap sends an email but role assignment fails, do not repeatedly resend. Inspect the membership record as the operator, correct the role for the explicitly approved user, and record the repair in the audit log.

## 4. Email scheduler and health

`vercel.json` schedules `/api/cron` once daily at 12:00 UTC. New event invitations, RSVP changes that promote waitlisted members, and workbook publications/restores request an immediate background delivery attempt via Next.js `after()`. Auth invitation/reset emails still send immediately through Supabase SMTP, independently of this worker. **Administration > audit > Process pending email now** provides a manual sweep. No five-minute scheduler is required for this implementation.

The daily sweep prepares reminders for confirmed attendees whose event begins within the next 25 hours. This is an upcoming-event reminder, not an exact 24-hour reminder. Delayed/missed invocations, quotas, network failures or an already-running worker can defer mail until another event action, the next daily sweep, or a manual sweep. There is no guaranteed prompt delivery SLA. The database enforces 80 event delivery attempts per rolling 24 hours, including retries/skipped claims; this leaves nominal headroom for Auth but does not enforce the email provider's total account quota. Monitor actual account limits and other applications using that sender.

Only one leased worker sends at a time. Each invocation works for approximately 45 seconds within a 60-second function limit. The payload and provider key are persisted before sending. Because [Resend idempotency keys expire after 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys), uncertain attempts older than 23 hours are held for administrator review rather than automatically resent. Five failures also require review. Check the provider log using the displayed message ID before marking delivered, skipping, or explicitly creating a fresh retry. This avoids blindly claiming exactly-once delivery across provider and database failures.

Use the operator's confirmed eligible Vercel arrangement. A low-frequency cron does **not** make paid client work eligible for Hobby: Vercel restricts Hobby to personal noncommercial use. Do not upgrade plans or add paid resources without authorization. [Vercel fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines), [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

The worker claims a limited batch with a lease, checks current member/invitation eligibility, uses provider idempotency keys and retries up to five times. It sends invitation, reminder, waitlist promotion, schedule-change and cancellation notices without putting private addresses/meeting URLs in email. Auth invitation/reset emails are sent immediately by Supabase, not this queue.

Monitor `/api/health` for configuration availability; it is not a deep Auth/SMTP/Google readiness check. Run `preflight --online` for read-only database/storage checks and complete the manual service checks below. Monitor Vercel errors, Auth logs and `/admin/audit` for delivery failures. Set external alerts for worker failures, exhausted attempts and delayed mail before launch; no external monitoring account is provisioned by the code.

Uploaded images/PDFs are limited to 3 MB, below the documented Vercel request-body limit with room for form overhead. Avatars become square WebP; editorial media retain their proportions, fit within 2000 pixels and use a separate private `editorial-images` bucket. Editorial images are served through an authenticated no-store endpoint, not public Storage URLs. Larger files need a separately designed direct-to-private-storage upload flow. [Vercel function limits](https://vercel.com/docs/functions/limitations).

## 5. Required staging acceptance

- Use two ordinary members, an administrator, an invited account, and a suspended/revoked account. Verify direct REST/Storage access, not just hidden UI controls.
- Send an actual invitation to an authorized internal inbox. Test confirmation in a different browser, email link scanning, expiry, replay, resending and profile completion. Resending an existing incomplete account sends a password-setup/recovery email; it still must finish the admission workflow.
- Complete a real password reset, confirm old passwords fail, and verify other sessions stop reading member data. The database checks that the JWT's `session_id` still exists in Auth. Test suspension followed by reactivation: suspended sessions are removed rather than becoming valid again. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions).
- Check an opted-out member is absent from directory search and cannot be viewed by another member; verify expertise, profession, education-group/institution, location, sorority and military filters. Sorority labels require Amanda's approved list.
- Edit a profile and upload a real image. Reject non-image, oversized and corrupt uploads. Verify another member cannot overwrite the avatar or download an opted-out member's photograph.
- Publish a public and a member Library resource. Test full-text/type filters, saving, removing, archival, restored IDs and private PDF downloads. Verify anonymous access to member files fails and a signed link expires after 60 seconds. An already issued link remains valid for at most its remaining lifetime.
- Create a board and an invitation-only dinner. Verify the non-invitee cannot see dinner copy or private details; race two RSVP requests against the last seat, cancel, check waitlist promotion and calendar export. Check email changes and cancellation notices.
- Publish the approved community guidelines URL to enable posting. Test thread/comment creation, own edits/removal, locked threads, reports, pin/hide and private introduction requests. Introduction emails are mediated manually by Amanda, not shared automatically.
- Publish malformed Sheets data, missing tabs, bad file IDs and a failed database update. Confirm no partial changes. Restore a prior revision with a reason and confirm operational member data is unchanged.
- On all six main member pages, add/duplicate/reorder/archive editorial sections; test each theme and mobile image placement. Verify ordinary members cannot access workbook previews, draft page copy, or unpublished media. Check archive-in-use rejection, bad asset IDs and restoring a revision whose image was archived. Media metadata edits are immediate and not part of workbook rollback.
- Send an event email to an authorized test inbox; simulate provider failure, ambiguous timeout and exhausted attempts. Confirm immediate/manual/daily paths, the shared lease, rolling allowance and review workflow. Read-only preflight and local mocks do not validate real email delivery.
- Review desktop/mobile layouts, keyboard focus, screen-reader navigation and contrast. Automated Chromium/axe checks supplement, not replace, this review. Verify actual iOS Safari and supported desktop browsers before release.

## 6. Amanda's routine operations

Use portal administration for invitations, name/email search, access changes, visibility moderation, PDF uploads, private event details, guest invitations, RSVP exports, conversation moderation, introduction status and revision history. Google Sheets is for editorial copy, taxonomy and schedules only.

An admin may hide a directory profile but cannot grant visibility consent for someone else. The member may opt back in through her profile. High-impact membership changes and rollback require confirmation and a recorded reason. An admin cannot suspend/revoke herself through the app.

The invitation list, resource/file lists, moderation queues and audit history display bounded recent records. Membership search and the Library/directory are paginated. Extend other admin lists with pagination before volume exceeds their displayed limits (100-200 recent records). Pending delivery failures remain visible in the audit area.

## 7. Cutover and rollback

1. Approve actual Library content, taxonomy gaps, community guidelines, event/cancellation policy, privacy text, retention policy and sender identity.
2. Configure automated database backups and independent backups of private Storage objects. Database backups alone do not replace object backups. Rehearse restoration in staging; agree recovery objectives with the client.
3. Create separate production services and repeat the staging acceptance checklist with approved test accounts. Do not import actual people into development fixtures.
4. Inventory existing Squarespace plans/accounts with Amanda. No pricing plan is automatically retired or migrated by this code.
5. Obtain the approved roster. `npm run import-roster -- --file <private-json-path>` validates a JSON email array without writing. `--apply` imports new pending invitation records, preserving existing ones, and sends no emails. Keep roster files outside Git; `.local/` is ignored.
6. Connect the production member subdomain and verify HTTPS. Update Squarespace Login to the portal URL only after acceptance. Deploy the one-line same-origin fix in `js/cnb-homepage.js` with the normal public-site release process.
7. Redirect the old `/member-home` preview only after checking the new member home. Preserve `/membership` as the marketing/inquiry route. Handle any legacy autojoin IDs only after the pricing-plan inventory is approved.
8. Send real invitations in small explicitly approved batches and monitor delivery/access. Do not enable public signup as a shortcut.

To roll back a launch, restore the prior Squarespace login links/redirects and disable further portal invitations. Preserve the portal database for diagnosis. To roll back code, redeploy the prior tested app version; do not roll back database migrations by destructive reset. Content rollback is available separately in portal administration.

## 8. Privacy support and retention

Account offers a private export and a contact path for deletion/access support. Deletion is intentionally not automatic: the client has not approved retention periods or how contributions should be anonymized. Before launch, agree this policy and an operator deletion/anonymization procedure covering Auth, profiles/avatars, discussions, RSVP dietary notes, introductions, invitations and backups. Never put these records in a public workbook or GitHub issue.

Do not log passwords, verification tokens, complete form bodies or discussion text. Do not forward auth confirmation URLs to analytics. Rotate server keys if they are exposed. If active memberships are revoked, keep the blocked status in place until the support request is resolved.

## Provider references

The implementation uses Supabase's supported [server-side email confirmation templates](https://supabase.com/docs/guides/auth/auth-email-templates), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Storage authorization](https://supabase.com/docs/guides/storage/security/access-control). Recheck account-level provider settings during deployment; project secrets/settings are not provisioned by committing application code.
