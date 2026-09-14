import { spawn } from "node:child_process";
import { resolve } from "node:path";

const fixturePort = "4181";
const portalPort = "4190";
const children = [];

function launch(command, args, env = process.env) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    shutdown(1);
  });
  return child;
}

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(code), 100).unref();
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

console.log("\nC+B LOCAL DEMO");
console.log(`Open: http://127.0.0.1:${portalPort}/login`);
console.log("Member: member@example.test / fixture-password-123");
console.log("Admin:  admin@example.test / fixture-password-123");
console.log(
  "Synthetic data only. Both servers listen on this computer only.\n",
);

const fixture = launch(process.execPath, ["tests/browser/server.mjs"]);
fixture.on("exit", (code) => {
  if (!stopping) {
    console.error(
      `Demo data service stopped unexpectedly (${code ?? "unknown"}).`,
    );
    shutdown(code || 1);
  }
});

const demoEnv = {
  ...process.env,
  NODE_ENV: "development",
  CNB_NEXT_DIST_DIR: ".next-demo",
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public-key",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
  PORTAL_URL: `http://127.0.0.1:${portalPort}`,
  TERMS_URL: "https://example.test/terms",
  PRIVACY_URL: "https://example.test/privacy",
  POLICY_VERSION: "local-demo-v1",
  SHEET_PUBLISH_SECRET: "local-demo-signature-secret-not-for-production",
  RESEND_API_KEY: "",
  MAIL_FROM: "",
  GOOGLE_SHEET_ID: "",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "",
  GOOGLE_PRIVATE_KEY: "",
};

const next = launch(
  process.execPath,
  [
    resolve("node_modules/next/dist/bin/next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    portalPort,
  ],
  demoEnv,
);
next.on("exit", (code) => {
  if (!stopping) shutdown(code || 0);
});
