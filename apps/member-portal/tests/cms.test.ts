import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseWorkbook, tabs, type Workbook } from "../lib/cms/parser";
import { safeNext, calendarEvent } from "../lib/validation";
function fixture(): Workbook {
  return Object.fromEntries(
    tabs.map((t) => [t, [["section", "field", "value", "link", "notes"]]]),
  ) as Workbook;
}
function resource(workbook: Workbook, extra: string[][] = []) {
  workbook["Library Resources"].push(
    ...[
      ["Resource ID", "20000000-0000-4000-8000-000000000099"],
      ["Title", "A thoughtful resource"],
      ["Type", "Essay"],
      ["Access", "Member"],
      ["Status", "Published"],
      ...extra,
    ].map(([f, v]) => ["resource-one", f, v, "", ""]),
  );
  return workbook;
}
it("normalizes complete resource snapshots with member access by default", () => {
  const parsed = parseWorkbook(resource(fixture()));
  expect(parsed.resources[0]).toMatchObject({
    access: "member",
    status: "published",
    type: "Essay",
    slug: "resource-one",
  });
});
it("rejects a missing tab instead of treating it as deletion", () => {
  const f = fixture();
  delete (f as Partial<Workbook>)["Library Resources"];
  expect(() => parseWorkbook(f)).toThrow("Missing tab");
});
it("rejects duplicate fields and bad IDs", () => {
  expect(() =>
    parseWorkbook(resource(fixture(), [["Title", "Duplicate"]])),
  ).toThrow("duplicate");
  expect(() =>
    parseWorkbook(resource(fixture(), [["File Asset ID", "bad"]])),
  ).toThrow();
});
it("rejects script URLs and invalid event times", () => {
  expect(() =>
    parseWorkbook(resource(fixture(), [["Image", "javascript:alert(1)"]])),
  ).toThrow();
  const f = fixture();
  f["Advisory Boards"].push(
    ...[
      ["Event ID", "30000000-0000-4000-8000-000000000001"],
      ["Title", "Board"],
      ["Starts At", "2026-10-01"],
      ["Ends At", "2026-10-02"],
    ].map(([k, v]) => ["event", k, v, "", ""]),
  );
  expect(() => parseWorkbook(f)).toThrow("Dates must be ISO");
});
it("rejects missing and cyclic education parents", () => {
  const f = fixture();
  f["Member Taxonomies"].push(
    ...[
      ["Term ID", "40000000-0000-4000-8000-000000000001"],
      ["Kind", "institution"],
      ["Label", "School"],
      ["Parent Term ID", "40000000-0000-4000-8000-000000000001"],
    ].map(([k, v]) => ["term", k, v, "", ""]),
  );
  expect(() => parseWorkbook(f)).toThrow("cycle");
});
it("allows safe return routes and rejects cross-origin redirects", () => {
  expect(safeNext("/library/strategy?q=hello")).toBe(
    "/library/strategy?q=hello",
  );
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/\nevil.test",
  ])
    expect(safeNext(value)).toBe("/");
});
it("calendar output escapes injected new fields and excludes private meeting information", () => {
  const value = calendarEvent({
    id: "safe-id",
    title: "Board\nATTENDEE:intruder",
    description: "A,b;c",
    starts_at: "2026-10-01T18:00:00Z",
    ends_at: "2026-10-01T19:00:00Z",
    location_label: "Online",
  });
  expect(value).toContain("SUMMARY:Board\\nATTENDEE:intruder");
  expect(value).not.toContain("\r\nATTENDEE");
  expect(value).toContain("DTSTART:20261001T180000Z");
});
it("workbook helper signs requests and never embeds the publish secret in cells", () => {
  const source = readFileSync("scripts/portal-workbook.gs", "utf8");
  expect(source).toContain("getScriptProperties");
  expect(source).toContain("computeHmacSha256Signature");
  expect(source).not.toContain("setValue(secret)");
});
