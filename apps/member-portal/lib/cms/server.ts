import "server-only";
import { createHash } from "node:crypto";
import { JWT } from "google-auth-library";
import { checked, serviceDatabase } from "../supabase";
import { parseWorkbook, tabs, type Workbook } from "./parser";
import { scheduleEventEmailDelivery } from "../email";
export async function readWorkbook(): Promise<Workbook> {
  if (
    !process.env.GOOGLE_SHEET_ID ||
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !process.env.GOOGLE_PRIVATE_KEY
  )
    throw new Error("Connect the private editorial workbook first.");
  const client = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const params = new URLSearchParams({ valueRenderOption: "FORMATTED_VALUE" });
  tabs.forEach((tab) => params.append("ranges", `'${tab}'!A:E`));
  const { data } = await client.request<{
    valueRanges: { values?: string[][] }[];
  }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(process.env.GOOGLE_SHEET_ID)}/values:batchGet?${params}`,
  });
  return Object.fromEntries(
    tabs.map((tab, index) => [tab, data.valueRanges[index]?.values || []]),
  ) as Workbook;
}
export async function publishFromSheet(
  preview: boolean,
  actor: string | null = null,
) {
  const payload = parseWorkbook(await readWorkbook());
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  const db = serviceDatabase();
  const mediaIds = [
    ...new Set(
      payload.content
        .filter((c) => c.section.startsWith("page-sections:"))
        .map((c) => c.fields as { imageAssetId?: string; status?: string })
        .filter((s) => s.status === "published" && s.imageAssetId)
        .map((s) => s.imageAssetId!),
    ),
  ];
  for (let i = 0; i < mediaIds.length; i += 200) {
    const batch = mediaIds.slice(i, i + 200);
    const media = checked(
      await db
        .from("editorial_media")
        .select("id")
        .eq("archived", false)
        .in("id", batch),
    );
    if (media.length !== batch.length)
      throw new Error(
        "A published section references a missing or archived Image Asset ID. Upload it in Administration > media first.",
      );
  }
  const fileIds = [
    ...new Set(
      payload.resources
        .map((r) => r.file_asset_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  for (let i = 0; i < fileIds.length; i += 200) {
    const batch = fileIds.slice(i, i + 200);
    const files = checked(
      await db.from("file_assets").select("id").in("id", batch),
    );
    if (files.length !== batch.length)
      throw new Error(
        "One or more File Asset IDs do not match an uploaded portal file. Upload the PDF in administration first.",
      );
  }
  const previous = checked(
    await db
      .from("cms_revisions")
      .select("source_hash,snapshot")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (previous?.source_hash === hash)
    return "The portal already has this version of the workbook.";
  const counts = `${payload.resources.length} resources, ${payload.terms.length} taxonomy terms, ${payload.events.length} events, ${payload.content.length} content sections`;
  const removals = ["resources", "terms", "events"]
    .map((key) => {
      const old = (previous?.snapshot[key] || []) as { id: string }[];
      const current = payload[key as "resources" | "terms" | "events"];
      return `${old.filter((row) => !current.some((item) => item.id === row.id)).length} ${key}`;
    })
    .join(", ");
  if (preview)
    return `Validated: ${counts}. To archive/deactivate: ${removals}. Publishing replaces the editorial snapshot.`;
  if (
    previous &&
    ((previous.snapshot.resources?.length > 0 && !payload.resources.length) ||
      (previous.snapshot.terms?.length > 0 && !payload.terms.length))
  )
    throw new Error(
      "An entire populated catalog is empty. Archive individual records rather than clearing a tab.",
    );
  const revision = checked(
    await db.rpc("publish_content", { payload, hash, actor }),
  );
  scheduleEventEmailDelivery();
  return `Published ${counts}. Revision ${revision}.`;
}
export async function rollbackRevision(
  id: string,
  actor: string,
  reason: string,
) {
  const db = serviceDatabase();
  const revision = checked(
    await db.rpc("restore_revision", { target: id, actor, reason }),
  );
  scheduleEventEmailDelivery();
  return `Restored selected content as revision ${revision}.`;
}
