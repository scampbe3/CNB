import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:4182",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "node tests/browser/server.mjs",
      url: "http://127.0.0.1:4183/health",
      env: { CNB_FIXTURE_PORT: "4183" },
      reuseExistingServer: false,
    },
    {
      command: "npx next dev --hostname 127.0.0.1 --port 4182",
      url: "http://127.0.0.1:4182/login",
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        CNB_NEXT_DIST_DIR: ".next-e2e",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4183",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public-key",
        SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
        PORTAL_URL: "http://127.0.0.1:4182",
        TERMS_URL: "https://example.test/terms",
        PRIVACY_URL: "https://example.test/privacy",
        POLICY_VERSION: "fixture-v1",
        SHEET_PUBLISH_SECRET: "fixture-only-secret-for-rejected-signatures",
        RESEND_API_KEY: "",
        MAIL_FROM: "",
        GOOGLE_SHEET_ID: "",
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "",
        GOOGLE_PRIVATE_KEY: "",
      },
    },
  ],
});
