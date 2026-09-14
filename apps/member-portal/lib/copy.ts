import "server-only";
import { database, checked } from "./supabase";
export async function portalCopy() {
  const db = await database();
  const rows = checked(
    await db.from("portal_content").select("section,fields"),
  ) as { section: string; fields: Record<string, unknown> }[];
  return (section: string, field: string, fallback: string) => {
    const value = rows.find((r) => r.section === section)?.fields[field];
    return typeof value === "string" && value.trim() ? value : fallback;
  };
}
