import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";

// Temporary synthetic identities exercise real hosted Auth/RLS. No emails are sent.
const ref = process.argv[2];
const origin = process.env.PORTAL_URL;
if (
  !process.argv.includes("--apply") ||
  ref !== "mswwugsnrhvibpzmimlc" ||
  process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co` ||
  origin !== "https://cnb-member-portal.vercel.app"
)
  throw new Error(
    "Explicit --apply and the known isolated staging project are required.",
  );
const makeClient = (key) =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const service = makeClient(process.env.SUPABASE_SERVICE_ROLE_KEY);
const created = [],
  clients = [];
let browser;
function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
try {
  const settings = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
    { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } },
  ).then((r) => r.json());
  assert.equal(settings.disable_signup, true);
  assert.equal(settings.external.email, true);
  assert.equal(settings.external.anonymous_users, false);
  console.log(
    "PASS: public signup is disabled, email login enabled, anonymous Auth disabled.",
  );
  for (const role of ["member", "admin"]) {
    const email = `smoke-${role}-${randomUUID()}@example.test`,
      password = randomBytes(24).toString("hex");
    const user = checked(
      await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
    ).user;
    created.push(user.id);
    checked(
      await service
        .from("memberships")
        .upsert({ user_id: user.id, status: "active", role }),
    );
    checked(
      await service
        .from("member_profiles")
        .upsert({
          user_id: user.id,
          display_name: `Temporary ${role}`,
          directory_visible: false,
          onboarding_complete: true,
        }),
    );
    const client = makeClient(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    checked(await client.auth.signInWithPassword({ email, password }));
    clients.push({ client, email, password, user });
    assert.equal(checked(await client.rpc("is_active")), true);
  }
  console.log(
    "PASS: real hosted password authentication and active-session checks.",
  );
  const member = clients[0],
    admin = clients[1];
  assert.equal(
    checked(
      await member.client
        .from("member_profiles")
        .select("user_id")
        .eq("user_id", admin.user.id),
    ).length,
    0,
  );
  assert.equal(
    checked(
      await member.client.rpc("admin_members", { query: "", page_number: 1 }),
    ).length,
    0,
  );
  console.log(
    "PASS: ordinary member cannot read an opted-out profile or admin roster.",
  );
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${origin}/login`);
  await page.getByLabel("Email address").fill(member.email);
  await page.getByLabel("Password", { exact: true }).fill(member.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(`${origin}/`);
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.goto(`${origin}/directory`);
  await page
    .getByRole("heading", { name: "In the Room", exact: true })
    .waitFor();
  await page.goto(`${origin}/admin`);
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  console.log(
    "PASS: hosted login, member navigation and admin route protection.",
  );
  checked(
    await service
      .from("memberships")
      .update({ status: "suspended" })
      .eq("user_id", member.user.id),
  );
  assert.equal(checked(await member.client.rpc("is_active")), false);
  assert.equal(
    checked(await member.client.from("member_profiles").select("user_id"))
      .length,
    0,
  );
  console.log(
    "PASS: suspension revokes access for an existing real Auth session.",
  );
  console.log(
    "Not tested: real invitation/reset delivery, Google publishing, private uploads or sender integration.",
  );
} finally {
  await browser?.close();
  let cleanupFailed = false;
  for (const id of created) {
    const result = await service.auth.admin.deleteUser(id);
    if (result.error) cleanupFailed = true;
  }
  if (cleanupFailed)
    throw new Error(
      "Temporary staging identity cleanup failed. Inspect Auth before continuing.",
    );
  console.log(
    `Removed ${created.length} temporary staging identities. No real members or emails created.`,
  );
}
