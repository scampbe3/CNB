import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

// Connect only the explicitly named staging resources. Never prints credential values.
const ref = process.argv[2];
if (ref !== "mswwugsnrhvibpzmimlc")
  throw new Error("Supply the known isolated staging Supabase project ref.");
const app = fileURLToPath(new URL("..", import.meta.url));
function cli(args, input) {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", ...args],
    {
      cwd: app,
      shell: process.platform === "win32",
      input,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    },
  );
  if (result.status !== 0)
    throw new Error(
      `Provider CLI failed (${args[0]} ${args[1]}). No credentials were logged. Check provider access and retry.`,
    );
  return result.stdout;
}
const linked = JSON.parse(readFileSync(`${app}/.vercel/project.json`, "utf8"));
if (linked.projectName !== "cnb-member-portal")
  throw new Error(
    "Link this folder to the cnb-member-portal Vercel project first.",
  );
const keys = JSON.parse(
  cli([
    "supabase@latest",
    "projects",
    "api-keys",
    "--project-ref",
    ref,
    "--reveal",
    "--output",
    "json",
  ]),
);
const publicKey =
  keys.find((k) => k.type === "publishable")?.api_key ||
  keys.find((k) => k.name === "anon")?.api_key;
const serverKey = keys.find((k) => k.name === "service_role")?.api_key;
if (!publicKey || !serverKey || publicKey === serverKey)
  throw new Error("Expected distinct public and server keys.");
const envPath = `${app}/.env.local`;
let existing = {};
try {
  existing = parseEnv(readFileSync(envPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const values = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
  SUPABASE_SERVICE_ROLE_KEY: serverKey,
  PORTAL_URL: "https://cnb-member-portal.vercel.app",
  CRON_SECRET: existing.CRON_SECRET || randomBytes(32).toString("hex"),
  SHEET_PUBLISH_SECRET:
    existing.SHEET_PUBLISH_SECRET || randomBytes(32).toString("hex"),
};
writeFileSync(
  envPath,
  Object.entries({ ...existing, ...values })
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
console.log(
  "Staging credentials stored in ignored .env.local; no values logged.",
);
if (!process.argv.includes("--vercel")) {
  console.log(
    "Add --vercel to configure this project's production environment (used as staging only).",
  );
  process.exit(0);
}
for (const [key, value] of Object.entries(values)) {
  cli(
    [
      "vercel@latest",
      "env",
      "add",
      key,
      "production",
      "--project",
      linked.projectId,
      "--scope",
      linked.orgId,
      "--force",
      "--yes",
      key.startsWith("NEXT_PUBLIC_") || key === "PORTAL_URL"
        ? "--no-sensitive"
        : "--sensitive",
    ],
    value,
  );
  console.log(
    `Configured ${key} in the isolated staging project's production target.`,
  );
}
console.log(
  "Google workbook, SMTP/Resend, policy URLs and enrollment remain unconfigured. No email sent.",
);
