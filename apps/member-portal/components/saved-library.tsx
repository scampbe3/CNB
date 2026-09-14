import Link from "next/link";
import { requireMember, checked } from "@/lib/supabase";
import type { Resource } from "@/lib/types";
import { resourceTypes } from "@/lib/validation";
import { ResourceCard, Empty, Field } from "./ui";
import { ActionForm } from "./form";
export async function SavedLibrary({
  query,
}: {
  query: Record<string, string | string[] | undefined>;
}) {
  const { db, user } = await requireMember();
  const term = typeof query.q === "string" ? query.q.toLowerCase() : "";
  const type = typeof query.type === "string" ? query.type : "";
  const saved = checked(
    await db
      .from("saved_resources")
      .select("resource_id,saved_at,saved_title,resources(*)")
      .eq("member_id", user.id)
      .order("saved_at", { ascending: false }),
  );
  const rows = saved
    .map((s) => ({
      ...s,
      resource: (Array.isArray(s.resources)
        ? s.resources[0]
        : s.resources) as Resource | null,
    }))
    .filter((s) =>
      s.resource
        ? (!term ||
            [
              s.resource.title,
              s.resource.summary,
              s.resource.body,
              ...(s.resource.topics || []),
            ]
              .join(" ")
              .toLowerCase()
              .includes(term)) &&
          (!type || s.resource.type === type)
        : !type && (!term || s.saved_title?.toLowerCase().includes(term)),
    );
  return (
    <>
      <form className="search">
        <Field name="q" label="Search saved resources" defaultValue={term} />
        <label>
          Resource type
          <select name="type" defaultValue={type}>
            <option value="">All</option>
            {resourceTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button>Search</button>
        <Link href="?">Clear</Link>
      </form>
      {rows.length ? (
        <div className="grid">
          {rows.map((s) =>
            s.resource ? (
              <ResourceCard
                key={s.resource_id}
                resource={s.resource}
                saved
                savedAt={s.saved_at}
              />
            ) : (
              <article className="panel" key={s.resource_id}>
                <h3>{s.saved_title || "Resource unavailable"}</h3>
                <p>This item has been archived or its access has changed.</p>
                <ActionForm action="save" label="Remove bookmark">
                  <input name="id" type="hidden" value={s.resource_id} />
                  <input name="saved" type="hidden" value="true" />
                </ActionForm>
              </article>
            ),
          )}
        </div>
      ) : (
        <Empty>
          {term || type
            ? "No saved resources match this search."
            : "Save something that makes you think. Your collection will appear here."}{" "}
          <Link href="/library">Explore the Library</Link>.
        </Empty>
      )}
    </>
  );
}
