import { z } from "zod";
import { safeNext } from "../validation";
export const pageNames = [
  "home",
  "library",
  "directory",
  "advisory-boards",
  "community",
  "dinners",
] as const;
export const sectionTypes = [
  "hero",
  "text-image",
  "cards",
  "cta",
  "existing",
  "library-feed",
  "event-feed",
  "directory-preview",
  "discussion-preview",
] as const;
export const sectionThemes = ["light", "lined", "black"] as const;
const link = z
  .string()
  .max(2000)
  .refine((s) => {
    if (!s) return true;
    if (s.startsWith("/"))
      return safeNext(s) === s && !/%(?:2f|5c|0[ad])/i.test(s);
    try {
      return new URL(s).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use a local portal path or an HTTPS link.");
const image = z
  .string()
  .max(2000)
  .refine((s) => {
    if (!s || /^\/images\/[a-z0-9-]+\.(webp|png|jpe?g)$/i.test(s)) return true;
    try {
      return new URL(s).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use a bundled image, HTTPS image URL or uploaded asset ID.");
export const pageSectionSchema = z
  .object({
    id: z.string().uuid(),
    page: z.enum(pageNames),
    type: z.enum(sectionTypes),
    status: z.enum(["draft", "published", "archived"]),
    order: z.number().int().min(0).max(10000),
    eyebrow: z.string().max(160).default(""),
    title: z.string().max(240).default(""),
    body: z.string().max(10000).default(""),
    image: image.default(""),
    imageAssetId: z.union([z.literal(""), z.string().uuid()]).default(""),
    imageAlt: z.string().max(500).default(""),
    imagePosition: z.enum(["left", "right", "above", "below"]).default("right"),
    focalX: z.number().min(0).max(100).nullable().default(null),
    focalY: z.number().min(0).max(100).nullable().default(null),
    theme: z.enum(sectionThemes).default("light"),
    ctaLabel: z.string().max(100).default(""),
    ctaLink: link.default(""),
    source: z
      .enum([
        "",
        "features",
        "events",
        "connections",
        "content",
        "board",
        "dinner",
      ])
      .default(""),
    cards: z
      .array(
        z.object({
          title: z.string().max(160),
          body: z.string().max(2000),
          label: z.string().max(100),
          link,
        }),
      )
      .max(4)
      .default([]),
  })
  .strict()
  .superRefine((s, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (s.type !== "existing" && !s.title) fail("A section title is required.");
    if (s.image && s.imageAssetId)
      fail("Choose an Image or Image Asset ID, not both.");
    if (s.image && !s.imageAlt) fail("Image Alt is required for an image URL.");
    if (Boolean(s.ctaLabel) !== Boolean(s.ctaLink))
      fail("CTA label and link must be supplied together.");
    if (s.cards.some((c) => Boolean(c.label) !== Boolean(c.link)))
      fail("Each card button needs both a label and link.");
    if (s.type === "cards" && !s.cards.length)
      fail("A cards section needs at least one card.");
    if (
      s.type === "existing" &&
      !(
        s.page === "home" ? ["features", "events", "connections"] : ["content"]
      ).includes(s.source)
    )
      fail("Existing section source does not belong to this page.");
    if (s.type === "event-feed" && !["board", "dinner", ""].includes(s.source))
      fail("Event feed source must be board, dinner or blank.");
  });
export type PageSection = z.infer<typeof pageSectionSchema>;
export function validatePageSections(values: PageSection[]) {
  if (new Set(values.map((s) => s.id)).size !== values.length)
    throw new Error("Duplicate Section IDs.");
  for (const page of pageNames) {
    const visible = values.filter(
      (s) => s.page === page && s.status === "published",
    );
    if (!visible.length) continue;
    if (visible.filter((s) => s.type === "hero").length !== 1)
      throw new Error(`${page}: keep exactly one published hero.`);
    const slots = visible
      .filter((s) => s.type === "existing")
      .map((s) => s.source);
    if (new Set(slots).size !== slots.length)
      throw new Error(`${page}: an existing section can only appear once.`);
    if (page !== "home" && !slots.includes("content"))
      throw new Error(
        `${page}: retain the existing content section with its search and member controls.`,
      );
  }
  return values;
}
export function parseSectionFields(f: Record<string, string>): PageSection {
  const coordinate = (s?: string) => (s?.trim() ? Number(s) : null);
  return pageSectionSchema.parse({
    id: f["Section ID"],
    page: f.Page,
    type: f["Section Type"],
    status: (f.Status || "Draft").toLowerCase(),
    order: Number(f["Display Order"] || 10),
    eyebrow: f.Eyebrow || "",
    title: f.Title || "",
    body: f.Body || "",
    image: f.Image || "",
    imageAssetId: f["Image Asset ID"] || "",
    imageAlt: f["Image Alt"] || "",
    imagePosition: f["Image Position"] || "right",
    focalX: coordinate(f["Focal X"]),
    focalY: coordinate(f["Focal Y"]),
    theme: f.Theme || "light",
    ctaLabel: f["CTA Label"] || "",
    ctaLink: f["CTA Link"] || "",
    source: f["Data Source"] || "",
    cards: [1, 2, 3, 4]
      .filter((i) => f[`Card ${i} Title`])
      .map((i) => ({
        title: f[`Card ${i} Title`],
        body: f[`Card ${i} Body`] || "",
        label: f[`Card ${i} Label`] || "",
        link: f[`Card ${i} Link`] || "",
      })),
  });
}
