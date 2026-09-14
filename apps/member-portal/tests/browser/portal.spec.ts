import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { pageSectionSchema } from "../../lib/cms/sections";
async function login(page: Page, admin = false) {
  await page.goto("/login");
  await page
    .getByLabel("Email address")
    .fill(`${admin ? "admin" : "member"}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("fixture-password-123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
}
async function accessible(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished),
    );
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("published section composition preserves controls and puts mobile images after text", async ({
  page,
  request,
}, info) => {
  await login(page, true);
  const auth = await request.post("http://127.0.0.1:4183/auth/v1/token", {
    data: { email: "admin@example.test", password: "fixture-password-123" },
  });
  const { access_token } = await auth.json();
  const headers = { Authorization: `Bearer ${access_token}` };
  const ids = [
    "70000000-0000-4000-8000-000000000091",
    "70000000-0000-4000-8000-000000000092",
    "70000000-0000-4000-8000-000000000093",
  ];
  const sections = [
    pageSectionSchema.parse({
      id: ids[0],
      page: "directory",
      type: "hero",
      status: "published",
      order: 10,
      title: "A room of thoughtful people",
      eyebrow: "In the Room",
      body: "Member connections, curated with care.",
      image: "/images/directory-hero.webp",
      imageAlt: "Members in the room",
      imagePosition: "left",
      theme: "lined",
    }),
    pageSectionSchema.parse({
      id: ids[1],
      page: "directory",
      type: "cta",
      status: "published",
      order: 20,
      title: "Bring your perspective",
      body: "A private space for considered questions.",
      theme: "black",
      ctaLabel: "Join discussions",
      ctaLink: "/community",
    }),
    pageSectionSchema.parse({
      id: ids[2],
      page: "directory",
      type: "existing",
      status: "published",
      order: 30,
      source: "content",
    }),
  ];
  try {
    for (const fields of sections) {
      const result = await request.post(
        "http://127.0.0.1:4183/rest/v1/portal_content",
        { headers, data: { section: `page-sections:${fields.id}`, fields } },
      );
      expect(result.ok()).toBeTruthy();
    }
    await page.goto("/directory");
    await expect(
      page.getByRole("heading", { name: "A room of thoughtful people" }),
    ).toBeVisible();
    await expect(page.getByLabel("Search members")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bring your perspective" }),
    ).toBeVisible();
    const hero = page.locator(`[data-section-id="${ids[0]}"]`);
    const image = await hero.locator("img").boundingBox(),
      body = await hero.locator("header").boundingBox();
    expect(image).toBeTruthy();
    expect(body).toBeTruthy();
    if (info.project.name === "mobile")
      expect(image!.y).toBeGreaterThan(body!.y + body!.height);
    else expect(image!.x + image!.width).toBeLessThan(body!.x);
    await accessible(page);
    await page.screenshot({
      path: info.outputPath("editable-sections.png"),
      fullPage: true,
    });
    await page.goto("/directory?cms_preview=1");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Workbook preview unavailable.",
    );
  } finally {
    for (const id of ids)
      await request.delete(
        `http://127.0.0.1:4183/rest/v1/portal_content?section=eq.page-sections:${id}`,
        { headers },
      );
  }
});
test("anonymous visitors can read public resources but cannot enter the directory", async ({
  page,
}) => {
  await page.goto("/directory");
  await expect(page).toHaveURL(/\/login/);
  await accessible(page);
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "A public perspective" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Better questions, better decisions" }),
  ).toHaveCount(0);
  await page.goto("/library/better-questions");
  await expect(page).toHaveURL(/\/login\?next=/);
});
test("login, member home and directory work at this viewport", async ({
  page,
}, info) => {
  await login(page);
  await expect(
    page.getByRole("link", { name: "Cupcakes and Broccoli website" }),
  ).toBeVisible();
  await expect(page.locator(".site-logo")).toHaveJSProperty("complete", true);
  await expect(page.getByRole("link", { name: "Account" })).toBeVisible();
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await page.getByText("Menu", { exact: true }).click();
  const memberNavigation = page.getByRole("navigation", {
    name: "Member navigation",
  });
  await expect(memberNavigation).toBeVisible();
  await expect(memberNavigation.getByRole("link")).toHaveCount(6);
  await expect(
    memberNavigation.getByRole("link", { name: "Home", exact: true }),
  ).toBeVisible();
  await expect(
    memberNavigation.getByRole("link", { name: "Member Home" }),
  ).toHaveCount(0);
  await expect(
    memberNavigation.getByRole("link", { name: "Account" }),
  ).toHaveCount(0);
  await expect(
    memberNavigation.getByRole("link", { name: "Discussions" }),
  ).toBeVisible();
  await expect(
    memberNavigation.getByRole("link", { name: "Introductions" }),
  ).toHaveCount(0);
  await expect(
    memberNavigation.getByRole("link", { name: "Saved" }),
  ).toHaveCount(0);
  const headerLayout = await page.evaluate(() => {
    const header = document.querySelector(".site-header")!;
    const navigation = document.querySelector(".portal-menu nav")!;
    const headerRect = header.getBoundingClientRect();
    const navigationRect = navigation.getBoundingClientRect();
    const brandRect = document
      .querySelector(".site-brand")!
      .getBoundingClientRect();
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(".header-control"),
    ).map((control) => control.getBoundingClientRect());
    return {
      viewportWidth: window.innerWidth,
      headerHeight: headerRect.height,
      navigationCenter: navigationRect.left + navigationRect.width / 2,
      navigationRight: navigationRect.right,
      navigationTop: navigationRect.top,
      brandBottom: brandRect.bottom,
      controlWidths: controls.map((control) => control.width),
      controlHeights: controls.map((control) => control.height),
    };
  });
  expect(
    Math.abs(headerLayout.controlWidths[0] - headerLayout.controlWidths[1]),
  ).toBeLessThan(1);
  expect(
    Math.abs(headerLayout.controlHeights[0] - headerLayout.controlHeights[1]),
  ).toBeLessThan(1);
  if (headerLayout.viewportWidth <= 760) {
    expect(headerLayout.headerHeight).toBeGreaterThanOrEqual(136);
    expect(headerLayout.headerHeight).toBeLessThanOrEqual(142);
    expect(headerLayout.navigationTop - headerLayout.brandBottom).toBeLessThan(
      36,
    );
    expect(
      headerLayout.navigationTop - headerLayout.brandBottom,
    ).toBeGreaterThan(8);
    expect(
      Math.abs(headerLayout.navigationCenter - headerLayout.viewportWidth / 2),
    ).toBeLessThan(3);
  } else {
    expect(headerLayout.headerHeight).toBeGreaterThanOrEqual(110);
    expect(
      headerLayout.viewportWidth - headerLayout.navigationRight,
    ).toBeLessThanOrEqual(25);
  }
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("member-home.png"),
    fullPage: true,
  });
  await page.goto("/directory");
  await expect(
    page.getByRole("heading", { name: "In the Room" }),
  ).toBeVisible();
  await page.getByLabel("Location", { exact: true }).fill("New York");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Test Founder", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Test Member", exact: true }),
  ).toHaveCount(0);
  await accessible(page);
});
test("Library search, persistent bookmark and removal", async ({ page }) => {
  await login(page);
  await page.goto("/library");
  await page.getByLabel("Search resources").fill("Better questions");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Better questions, better decisions" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Better questions, better decisions" })
    .click();
  await page
    .getByRole("button", { name: "Save resource", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove bookmark" }),
  ).toBeVisible();
  await page.goto("/saved");
  await expect(page).toHaveURL(/\/members\/[^/]+#saved-library$/);
  await expect(
    page.getByRole("heading", { name: "Better questions, better decisions" }),
  ).toBeVisible();
  await accessible(page);
  await page.goto("/members/10000000-0000-4000-8000-000000000001");
  await expect(
    page.getByRole("heading", { name: "Saved from the Library" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Better questions, better decisions" }),
  ).toBeVisible();
  await page.goto("/saved");
  await page.getByRole("button", { name: /Unsave|Remove bookmark/ }).click();
  await expect(
    page.getByText("Save something that makes you think.", { exact: false }),
  ).toBeVisible();
});
test("profile, gatherings, discussions and account render without overflow", async ({
  page,
}, info) => {
  await login(page);
  for (const route of [
    "/profile/edit",
    "/advisory-boards",
    "/dinners",
    "/community",
    "/account",
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    await accessible(page);
  }
  await page.goto("/introductions");
  await expect(page).toHaveURL(/\/account#introduction-requests$/);
  await expect(
    page.getByRole("heading", { name: "Introduction requests" }),
  ).toBeVisible();
  await page.goto("/advisory-boards");
  await page.getByRole("button", { name: "Update RSVP" }).click();
  await expect(page.getByText("Your RSVP: yes")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("gatherings.png"),
    fullPage: true,
  });
});
test("seeded directory profiles and conversations carry context across pages", async ({
  page,
}) => {
  await login(page);
  await page.goto("/directory");
  await expect(page.getByText("9 members found")).toBeVisible();
  await page.getByRole("link", { name: "Amara Bell" }).click();
  await expect(
    page.getByRole("heading", {
      name: "What does a candid leadership transition sound like?",
    }),
  ).toBeVisible();
  await page.goto("/community");
  await expect(
    page.getByRole("heading", {
      name: "How do you know when growth is costing too much?",
    }),
  ).toBeVisible();
  await expect(page.getByText("Nia James", { exact: true })).toBeVisible();
  await page
    .getByRole("link", {
      name: "How do you know when growth is costing too much?",
    })
    .click();
  await expect(
    page.getByText("Borrowed urgency is exactly the phrase."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  await accessible(page);
});
test("page heroes use landscape desktop columns and stack after copy on mobile", async ({
  page,
}) => {
  await login(page);
  for (const route of [
    "/",
    "/library",
    "/directory",
    "/advisory-boards",
    "/community",
    "/dinners",
  ]) {
    await page.goto(route);
    const geometry = await page.locator(".page-hero").evaluate((hero) => {
      const heading = hero.querySelector(".section-heading")!;
      const body = hero.querySelector(".lede")!;
      const image = hero.querySelector("img")!;
      const headingRect = heading.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        headingRight: headingRect.right,
        bodyBottom: bodyRect.bottom,
        imageLeft: imageRect.left,
        imageTop: imageRect.top,
        ratio: imageRect.width / imageRect.height,
      };
    });
    expect(geometry.ratio).toBeGreaterThan(1.72);
    expect(geometry.ratio).toBeLessThan(1.84);
    if (geometry.viewport <= 760) {
      expect(geometry.imageTop).toBeGreaterThan(geometry.bodyBottom);
    } else {
      expect(geometry.imageLeft).toBeGreaterThan(geometry.headingRight);
    }
  }
  await page.goto("/");
  await expect(page.locator(".home-gathering-image img")).toBeVisible();
  await expect(page.locator(".home-gathering-image img")).toHaveJSProperty(
    "complete",
    true,
  );
  if (await page.evaluate(() => window.innerWidth > 760)) {
    const cardHeights = await page
      .locator(".home-gathering-image")
      .evaluate((image) => {
        const event = image.parentElement!.querySelector(".event-card")!;
        const panel = document.querySelector(".section.grid .panel")!;
        return {
          event: event.getBoundingClientRect().height,
          image: image.getBoundingClientRect().height,
          panel: panel.getBoundingClientRect().height,
        };
      });
    expect(cardHeights.event).toBeLessThan(220);
    expect(Math.abs(cardHeights.event - cardHeights.image)).toBeLessThan(2);
    expect(Math.abs(cardHeights.event - cardHeights.panel)).toBeLessThan(18);
  }
});
test("member cannot open administration, administrator can", async ({
  page,
}, info) => {
  await login(page);
  await page.goto("/admin/members");
  await expect(page).toHaveURL("/");
  await page.context().clearCookies();
  await login(page, true);
  for (const section of [
    "members",
    "invitations",
    "profiles",
    "resources",
    "events",
    "discussions",
    "introductions",
    "sheet-publishing",
    "audit",
  ]) {
    await page.goto(`/admin/${section}`);
    await expect(
      page.getByRole("heading", { name: "Keep the room running." }),
    ).toBeVisible();
    await accessible(page);
  }
  await page.screenshot({ path: info.outputPath("admin.png"), fullPage: true });
});
test("publishing rejects unsigned and malformed signatures", async ({
  request,
}) => {
  expect(
    (await request.post("/api/cms", { data: { preview: false } })).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/cms", {
        headers: { "x-cnb-signature": "x".repeat(64) },
        data: { preview: true },
      })
    ).status(),
  ).toBe(401);
});
