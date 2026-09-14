import { createClient } from "@supabase/supabase-js";
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PORTAL_URL",
  "GOOGLE_SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "SHEET_PUBLISH_SECRET",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "SUPPORT_EMAIL",
  "TERMS_URL",
  "PRIVACY_URL",
  "POLICY_VERSION",
];
let failures = 0;
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures++;
}
for (const key of required)
  check(Boolean(process.env[key]), `${key} configured`);
for (const key of [
  "PORTAL_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "TERMS_URL",
  "PRIVACY_URL",
]) {
  try {
    const u = new URL(process.env[key]);
    check(
      u.protocol === "https:" ||
        (!["TERMS_URL", "PRIVACY_URL"].includes(key) &&
          ["localhost", "127.0.0.1"].includes(u.hostname)),
      `${key} uses HTTPS (or local development)`,
    );
  } catch {
    check(false, `${key} is a valid URL`);
  }
}
for (const key of ["SHEET_PUBLISH_SECRET", "CRON_SECRET"])
  check(
    (process.env[key] || "").length >= 32,
    `${key} has at least 32 random characters`,
  );
check(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !==
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  "Server credential is not the public key",
);
if (!failures && process.argv.includes("--online")) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  for (const table of [
    "memberships",
    "member_consents",
    "resources",
    "cms_revisions",
    "email_outbox",
    "editorial_media",
  ]) {
    const { error } = await db
      .from(table)
      .select("*", { head: true, count: "exact" });
    check(!error, `${table} is accessible to the server`);
  }
  const { data: buckets, error } = await db.storage.listBuckets();
  for (const id of ["member-avatars", "member-resources", "editorial-images"])
    check(
      !error && buckets?.some((b) => b.id === id && !b.public),
      `${id} bucket is private`,
    );
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const delivery = await db
    .from("email_outbox")
    .select("id,delivery_payload,needs_review,next_attempt_at,skipped_at", {
      head: true,
    });
  check(!delivery.error, "Daily delivery migration is installed");
  for (const table of ["editorial_media", "portal_content", "email_outbox"]) {
    const result = await anon.from(table).select("*").limit(1);
    check(
      Boolean(result.error) || !result.data?.length,
      `Anonymous API cannot read ${table}`,
    );
  }
  const privateRows = await anon.from("member_profiles").select("user_id");
  check(
    Boolean(privateRows.error) || !privateRows.data?.length,
    "Anonymous API does not expose profiles",
  );
  const privateResources = await anon
    .from("resources")
    .select("id")
    .eq("access", "member");
  check(
    !privateResources.error && !privateResources.data?.length,
    "Anonymous API cannot read member resources",
  );
}
console.log(
  "Still required manually: private workbook sharing, Auth signup disabled, SMTP/templates, policy approval, staging invitations, backups and monitoring. No email was sent by this check.",
);
process.exitCode = failures ? 1 : 0;
