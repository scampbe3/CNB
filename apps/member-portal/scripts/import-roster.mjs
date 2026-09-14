import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const args = process.argv.slice(2);
const file = args[args.indexOf("--file") + 1];
if (!args.includes("--file") || !file)
  throw new Error(
    "Provide --file with a private JSON array of approved email addresses.",
  );
const roster = z
  .array(z.email())
  .min(1)
  .max(500)
  .parse(JSON.parse(await readFile(file, "utf8")))
  .map((email) => email.toLowerCase().trim());
const unique = [...new Set(roster)];
console.log(
  `${roster.length} rows; ${unique.length} unique addresses; ${roster.length - unique.length} duplicates removed.`,
);
if (!args.includes("--apply")) {
  console.log("Dry run only. No records written and no emails sent.");
  process.exit(0);
}
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
)
  throw new Error("Server configuration required.");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const result = await db.from("member_invitations").upsert(
  unique.map((email) => ({ email })),
  { onConflict: "email", ignoreDuplicates: true },
);
if (result.error)
  throw new Error("Import failed. Check migrations and server credentials.");
console.log(
  "New pending invitation records imported. Existing records preserved. No emails sent. Send approved invitations individually from portal administration.",
);
