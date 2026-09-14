import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
it("local and staging Auth allow email login while blocking public registration", () => {
  for (const path of [
    "../../supabase/config.toml",
    "../../supabase/staging/supabase/config.toml",
  ]) {
    const config = readFileSync(path, "utf8");
    expect(config.match(/\[auth\]([\s\S]*?)\[auth.email\]/)?.[1]).toContain(
      "enable_signup = false",
    );
    expect(config.match(/\[auth.email\]([\s\S]*?)(?:\n\[|$)/)?.[1]).toContain(
      "enable_signup = true",
    );
  }
});
import {
  pageSectionSchema,
  validatePageSections,
  parseSectionFields,
} from "../lib/cms/sections";
const hero = () =>
  pageSectionSchema.parse({
    id: "70000000-0000-4000-8000-000000000001",
    page: "home",
    type: "hero",
    title: "Welcome",
    status: "published",
    order: 10,
  });
it("validates safe editable sections, not arbitrary HTML or executable URLs", () => {
  expect(hero().theme).toBe("light");
  for (const ctaLink of [
    "javascript:alert(1)",
    "//evil.test",
    "/%5cevil.test",
    "http://unsafe.test",
  ])
    expect(() =>
      pageSectionSchema.parse({ ...hero(), ctaLabel: "Go", ctaLink }),
    ).toThrow();
  expect(
    pageSectionSchema.parse({
      ...hero(),
      ctaLabel: "Open",
      ctaLink: "/library",
    }).ctaLink,
  ).toBe("/library");
  expect(() =>
    pageSectionSchema.parse({ ...hero(), html: "<script>bad()</script>" }),
  ).toThrow();
});
it("requires one hero, unique IDs and protected content controls", () => {
  expect(() => validatePageSections([hero(), hero()])).toThrow("Duplicate");
  expect(() => validatePageSections([{ ...hero(), page: "library" }])).toThrow(
    "retain",
  );
  expect(() => validatePageSections([{ ...hero(), type: "cta" }])).toThrow(
    "hero",
  );
  expect(validatePageSections([{ ...hero(), status: "draft" }])).toHaveLength(
    1,
  );
});
it("requires accessible images, bounded focal points and a single image source", () => {
  expect(() =>
    pageSectionSchema.parse({ ...hero(), image: "/images/library-hero.webp" }),
  ).toThrow();
  expect(() =>
    pageSectionSchema.parse({
      ...hero(),
      imageAssetId: hero().id,
      image: "https://example.test/a.webp",
      imageAlt: "Image",
    }),
  ).toThrow();
  expect(() => pageSectionSchema.parse({ ...hero(), focalY: 101 })).toThrow();
  expect(() =>
    pageSectionSchema.parse({
      ...hero(),
      image: "/api/private",
      imageAlt: "Bad",
    }),
  ).toThrow();
});
it("maps the familiar workbook fields and card buttons", () => {
  expect(
    parseSectionFields({
      "Section ID": hero().id,
      Page: "home",
      "Section Type": "cards",
      Title: "Explore",
      Status: "Published",
      "Display Order": "30",
      "Card 1 Title": "Library",
      "Card 1 Label": "Open",
      "Card 1 Link": "/library",
    }),
  ).toMatchObject({
    order: 30,
    cards: [{ title: "Library", link: "/library" }],
  });
});
it("starter sections validate for all six member pages", () => {
  const rows = readFileSync("cms-templates/Page Sections.csv", "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) =>
      line
        .slice(1, -1)
        .split('","')
        .map((s) => s.replaceAll('""', '"')),
    );
  const groups = new Map<string, Record<string, string>>();
  for (const [key, field, value] of rows) {
    const fields = groups.get(key) || {};
    fields[field] = value;
    groups.set(key, fields);
  }
  const sections = validatePageSections(
    [...groups.values()].map(parseSectionFields),
  );
  expect(sections.filter((s) => s.type === "hero")).toHaveLength(6);
  for (const s of sections.filter((s) => s.image))
    expect(readFileSync(`public${s.image}`).length).toBeGreaterThan(0);
});
it("the Apps Script helper parses and exposes section and import operations", () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync("scripts/portal-workbook.gs", "utf8"), context);
  for (const name of [
    "cnbPortalAddSection",
    "cnbPortalDuplicateSection",
    "cnbPortalArchiveSection",
    "cnbPortalOrderSection",
    "cnbPortalVisualPreview",
    "cnbPortalImportZip",
  ])
    expect(typeof context[name]).toBe("function");
});
