import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const args = process.argv.slice(2);
if (!args.includes("--email"))
  throw new Error("Provide the approved first administrator with --email.");
const email = z
  .email()
  .parse(args[args.indexOf("--email") + 1])
  .toLowerCase();
if (
  !process.env.SUPABASE_SERVICE_ROLE_KEY ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL
)
  throw new Error("Load the server environment first.");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const { data: admins, error } = await db
  .from("memberships")
  .select("user_id")
  .eq("role", "admin")
  .limit(1);
if (error)
  throw new Error("Apply migrations before bootstrapping the administrator.");
if (admins.length)
  throw new Error(
    "An administrator already exists. This bootstrap is only for the first administrator.",
  );
if (!args.includes("--send-invite")) {
  console.log(
    "Dry run passed. --send-invite creates the first administrator and sends an invitation to the explicitly supplied email. Nothing was written or sent.",
  );
  process.exit(0);
}
for (const key of ["PORTAL_URL", "POLICY_VERSION", "TERMS_URL", "PRIVACY_URL"])
  if (!process.env[key])
    throw new Error(`Set ${key} before sending invitations.`);
const invitation = await db
  .from("member_invitations")
  .upsert(
    { email, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() },
    { onConflict: "email" },
  );
if (invitation.error) throw new Error("Could not create invitation.");
const result = await db.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${process.env.PORTAL_URL}/auth/confirm`,
});
if (result.error || !result.data.user)
  throw new Error(
    "Auth invitation failed. Check SMTP and whether the email is already registered.",
  );
const promotion = await db
  .from("memberships")
  .update({ role: "admin" })
  .eq("user_id", result.data.user.id)
  .select("user_id")
  .single();
if (promotion.error)
  throw new Error(
    "Invitation sent but administrator role was not applied. Operator intervention required.",
  );
await db
  .from("audit_events")
  .insert({ action: "admin.bootstrapped", target: result.data.user.id });
console.log(
  "First administrator invited. She must verify her email, choose a password, and finish onboarding before accessing administration.",
);
