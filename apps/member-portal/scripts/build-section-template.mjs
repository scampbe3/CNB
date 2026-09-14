import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Deterministic IDs keep regenerated starter templates compatible with revisions.
const heroes = [
  [
    "home",
    "The Decision Room",
    "Welcome back.",
    "What decision are you thinking through today?",
    "member-home-landscape",
    "The Decision Room member artwork",
  ],
  [
    "library",
    "The Library",
    "Ideas worth thinking about.",
    "Essays, AI prompts, decision briefs and business cases for better questions and better decisions.",
    "library-hero",
    "Amanda reading and reflecting in the Library",
  ],
  [
    "directory",
    "In the Room",
    "In the Room",
    "Search by profession, education, location or sorority to discover members you may want to meet, learn from or simply get to know.",
    "directory-hero",
    "A portrait from The Decision Room collection",
  ],
  [
    "advisory-boards",
    "A little collective wisdom",
    "Monthly advisory boards.",
    "Bring the decision you are working through. Think it through with the room.",
    "advisory-boards-hero",
    "Amanda speaking during a thoughtful panel conversation",
  ],
  [
    "community",
    "Private community",
    "Confidential discussions.",
    "Keep what is shared here in the room. Be thoughtful, respectful, and generous with one another.",
    "discussions-hero",
    "Guests engaged in conversation around a shared table",
  ],
  [
    "dinners",
    "Invitation-only dinners",
    "A seat at the table.",
    "Your personal invitations and the details for each gathering.",
    "dinners-hero",
    "Guests gathered around a Blind Dinner table",
  ],
];
const rows = [["section", "field", "value", "link", "notes"]];
let count = 0;
for (const [page, eyebrow, title, body, image, alt] of heroes) {
  const sections = [
    {
      "Section Type": "hero",
      Title: title,
      Eyebrow: eyebrow,
      Body: body,
      Image: `/images/${image}.webp`,
      "Image Alt": alt,
    },
    ...(page === "home"
      ? ["features", "events", "connections"]
      : ["content"]
    ).map((source) => ({ "Section Type": "existing", "Data Source": source })),
  ];
  sections.forEach((section, index) => {
    const id = `70000000-0000-4000-8000-${String(++count).padStart(12, "0")}`;
    const fields = {
      "Section ID": id,
      Page: page,
      "Section Type": "text-image",
      Status: "Published",
      "Display Order": String((index + 1) * 10),
      Eyebrow: "",
      Title: "",
      Body: "",
      Image: "",
      "Image Asset ID": "",
      "Image Alt": "",
      "Image Position": "right",
      "Focal X": "",
      "Focal Y": "",
      Theme: "light",
      "CTA Label": "",
      "CTA Link": "",
      "Data Source": "",
      ...section,
    };
    for (const [field, value] of Object.entries(fields))
      rows.push([
        `section-${id}`,
        field,
        value,
        "",
        field === "Section ID" ? "Permanent ID; do not change." : "",
      ]);
  });
}
const csv =
  rows
    .map((row) =>
      row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
    )
    .join("\n") + "\n";
writeFileSync(
  fileURLToPath(new URL("../cms-templates/Page Sections.csv", import.meta.url)),
  csv,
);
console.log(
  "Generated Page Sections.csv. Review before importing; never overwrite a live workbook with starter content.",
);
