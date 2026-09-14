import { z } from "zod";
import { httpsUrl, resourceTypes } from "../validation";
import { parseSectionFields, validatePageSections } from "./sections";
export const tabs = [
  "member-home",
  "Portal Settings",
  "Library Resources",
  "Member Taxonomies",
  "Advisory Boards",
  "Blind Dinner Events",
  "Page Sections",
] as const;
export type Workbook = Record<(typeof tabs)[number], string[][]>;
type Fields = Record<string, string>;
type Section = { key: string; fields: Fields; links: Fields; notes: Fields };
const uid = z.string().uuid();
function groups(rows: string[][], tab: string): Section[] {
  if (
    rows[0]?.map((s) => s.toLowerCase().trim()).join(",") !==
    "section,field,value,link,notes"
  )
    throw new Error(`${tab}: headers must be section,field,value,link,notes.`);
  const sections = new Map<string, Section>();
  rows.slice(1).forEach((row, index) => {
    if (row.every((v) => !v.trim())) return;
    const [key, field, value = "", link = "", note = ""] = row.map((s) =>
      s.trim(),
    );
    if (!key || !field)
      throw new Error(
        `${tab}, row ${index + 2}: section and field are required.`,
      );
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(key))
      throw new Error(`${tab}: invalid section ${key}.`);
    const group = sections.get(key) || {
      key,
      fields: {},
      links: {},
      notes: {},
    };
    if (Object.hasOwn(group.fields, field))
      throw new Error(`${tab}: duplicate ${key}/${field}.`);
    group.fields[field] = value;
    group.links[field] = link;
    group.notes[field] = note;
    sections.set(key, group);
  });
  return [...sections.values()];
}
const required = (f: Fields, key: string) =>
  z.string().min(1, `${key} is required`).max(100000).parse(f[key]);
const integer = (s: string | undefined, fallback: number) =>
  s ? z.coerce.number().int().min(0).max(10000).parse(s) : fallback;
const optionalUrl = (s: string | undefined) => (s ? httpsUrl(s) : null);
function date(s: string | undefined, requiredValue = false) {
  if (!s && !requiredValue) return null;
  if (
    !s ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(s) ||
    Number.isNaN(Date.parse(s))
  )
    throw new Error(
      "Dates must be ISO timestamps including a timezone, for example 2026-10-01T18:00:00-04:00.",
    );
  return new Date(s).toISOString();
}
function unique<T extends { id: string }>(values: T[], label: string) {
  if (new Set(values.map((v) => v.id)).size !== values.length)
    throw new Error(`Duplicate IDs in ${label}.`);
}
export function parseWorkbook(workbook: Workbook) {
  for (const tab of tabs)
    if (!Array.isArray(workbook[tab]))
      throw new Error(`Missing tab: ${tab}. No changes were published.`);
  const terms = groups(workbook["Member Taxonomies"], "Member Taxonomies").map(
    ({ fields: f }) => ({
      id: uid.parse(required(f, "Term ID")),
      kind: z
        .enum([
          "profession",
          "expertise",
          "education_group",
          "institution",
          "sorority",
          "military_service",
          "topic",
        ])
        .parse(required(f, "Kind")),
      label: z.string().min(1).max(160).parse(required(f, "Label")),
      parent_id: f["Parent Term ID"] ? uid.parse(f["Parent Term ID"]) : null,
      active: z.enum(["TRUE", "FALSE"]).parse(f.Active || "TRUE") === "TRUE",
      display_order: integer(f["Display Order"], 10),
    }),
  );
  unique(terms, "Member Taxonomies");
  if (
    new Set(terms.map((t) => `${t.kind}:${t.label.toLowerCase()}`)).size !==
    terms.length
  )
    throw new Error("Duplicate taxonomy labels.");
  for (const term of terms) {
    const visited = new Set([term.id]);
    let parent = term.parent_id;
    while (parent) {
      if (visited.has(parent))
        throw new Error("Taxonomy hierarchy contains a cycle.");
      visited.add(parent);
      const row = terms.find((t) => t.id === parent);
      if (!row) throw new Error(`Missing parent for ${term.label}.`);
      parent = row.parent_id;
    }
  }
  const resources = groups(
    workbook["Library Resources"],
    "Library Resources",
  ).map(({ key, fields: f, links, notes }) => ({
    id: uid.parse(required(f, "Resource ID")),
    slug: f.Slug || key,
    title: z.string().min(1).max(240).parse(required(f, "Title")),
    summary: f.Summary || "",
    body: f.Body || "",
    type: z.enum(resourceTypes).parse(required(f, "Type")),
    access: z
      .enum(["public", "member"])
      .parse((f.Access || "Member").toLowerCase()),
    status: z
      .enum(["draft", "published", "archived"])
      .parse((f.Status || "Draft").toLowerCase()),
    author: f.Author || "",
    topics: Object.entries(f)
      .filter(([k]) => /^Topic \d+$/.test(k))
      .map(([, v]) => v),
    published_at: date(f["Publish Date"]),
    image: optionalUrl(f.Image),
    image_alt: notes.Image || "",
    file_asset_id: f["File Asset ID"] ? uid.parse(f["File Asset ID"]) : null,
    external_url: optionalUrl(links["External Link"] || f["External Link"]),
    display_order: integer(f["Display Order"], 10),
  }));
  unique(resources, "Library Resources");
  if (
    resources.some((r) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) ||
    new Set(resources.map((r) => r.slug)).size !== resources.length
  )
    throw new Error(
      "Resource slugs must be unique lowercase words separated by hyphens.",
    );
  const events = (["Advisory Boards", "Blind Dinner Events"] as const).flatMap(
    (tab) =>
      groups(workbook[tab], tab).map(({ fields: f }) => {
        const timezone = f.Timezone || "America/New_York";
        try {
          new Intl.DateTimeFormat("en", { timeZone: timezone });
        } catch {
          throw new Error("Invalid event timezone.");
        }
        const starts_at = date(f["Starts At"], true)!,
          ends_at = date(f["Ends At"], true)!;
        if (ends_at <= starts_at)
          throw new Error("Event end must be after its start.");
        return {
          id: uid.parse(required(f, "Event ID")),
          type: tab === "Advisory Boards" ? "board" : "dinner",
          title: required(f, "Title"),
          description: f.Description || "",
          starts_at,
          ends_at,
          timezone,
          capacity: z.number().min(1).parse(integer(f.Capacity, 20)),
          status: z
            .enum(["draft", "published", "cancelled", "archived"])
            .parse((f.Status || "Draft").toLowerCase()),
          location_label: f["Location Label"] || "",
          image: optionalUrl(f.Image),
        };
      }),
  );
  unique(events, "Events");
  const content = (["member-home", "Portal Settings"] as const).flatMap((tab) =>
    groups(workbook[tab], tab).map(({ key, fields, links, notes }) => ({
      section: `${tab}:${key}`,
      fields: { ...fields, _links: links, _notes: notes },
    })),
  );
  for (const section of content) {
    for (const [field, value] of Object.entries(section.fields)) {
      if (
        typeof value === "string" &&
        value &&
        (field.endsWith(" URL") || field === "Image")
      )
        optionalUrl(value);
    }
  }
  const pageSections = validatePageSections(
    groups(workbook["Page Sections"], "Page Sections").map((s) =>
      parseSectionFields(s.fields),
    ),
  );
  return {
    terms,
    resources,
    events,
    content: [
      ...content,
      ...pageSections.map((s) => ({
        section: `page-sections:${s.id}`,
        fields: s,
      })),
    ],
  };
}
