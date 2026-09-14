import { Children, type ReactNode, type CSSProperties } from "react";
import Link from "next/link";
import { database, checked, requireMember } from "@/lib/supabase";
import { pageSectionSchema, type PageSection } from "@/lib/cms/sections";
import { readWorkbook } from "@/lib/cms/server";
import { parseWorkbook } from "@/lib/cms/parser";
import type { DirectoryMember, Resource, Thread } from "@/lib/types";

export async function PageSections({
  page,
  children,
  enabled = true,
  preview = false,
}: {
  page: PageSection["page"];
  children: ReactNode;
  enabled?: boolean;
  preview?: boolean;
}) {
  if (!enabled) return children;
  const db = await database();
  if (preview) await requireMember(true);
  let rows;
  if (preview) {
    try {
      rows = parseWorkbook(await readWorkbook()).content;
    } catch {
      return (
        <>
          <p className="empty" role="alert">
            Workbook preview unavailable. Connect the private editorial workbook
            and run Preview changes in Administration to check validation.
            Published content has not changed.
          </p>
          {children}
        </>
      );
    }
  } else
    rows = checked(await db.from("portal_content").select("section,fields"));
  const sections: PageSection[] = rows
    .filter((r) => r.section.startsWith("page-sections:"))
    .map((r) => pageSectionSchema.parse(r.fields))
    .filter((s) => s.page === page && s.status === "published")
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  if (!sections.length)
    return (
      <>
        {preview && (
          <p className="empty">
            Workbook preview: no published page sections. The existing layout is
            shown.
          </p>
        )}
        {children}
      </>
    );
  const original = Children.toArray(children);
  const sources: Record<string, ReactNode> =
    page === "home"
      ? { features: original[1], events: original[2], connections: original[3] }
      : { content: original.slice(1) };
  return (
    <>
      {preview && (
        <p className="empty">
          Workbook preview. These changes have not been published.
        </p>
      )}
      {sections.map((s) =>
        s.type === "existing" ? (
          <div
            className={`cms-existing cms-theme-${s.theme}`}
            data-section-id={s.id}
            key={s.id}
          >
            {sources[s.source]}
          </div>
        ) : (
          <EditorialSection section={s} key={s.id} />
        ),
      )}
    </>
  );
}
async function EditorialSection({ section: s }: { section: PageSection }) {
  const db = await database();
  const media = s.imageAssetId
    ? checked(
        await db
          .from("editorial_media")
          .select("id,alt,focal_x,focal_y")
          .eq("id", s.imageAssetId)
          .maybeSingle(),
      )
    : null;
  const src = media ? `/api/media/${media.id}` : s.image;
  const Title = s.type === "hero" ? "h1" : "h2";
  let feed: ReactNode = null;
  if (s.type === "library-feed") {
    const records = checked(
      await db
        .from("resources")
        .select("*")
        .eq("status", "published")
        .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`)
        .order("display_order")
        .limit(4),
    ) as Resource[];
    feed = (
      <div className="grid">
        {records.map((r) => (
          <article className="panel" key={r.id}>
            <h3>
              <Link href={`/library/${r.slug}`}>{r.title}</Link>
            </h3>
            <p>{r.summary}</p>
          </article>
        ))}
      </div>
    );
  } else if (s.type === "event-feed") {
    let request = db
      .from("events")
      .select("id,title,starts_at,type")
      .eq("status", "published")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(4);
    if (s.source) request = request.eq("type", s.source);
    const records = checked(await request);
    feed = (
      <div className="grid">
        {records.map((r) => (
          <article className="panel" key={r.id}>
            <h3>{r.title}</h3>
            <Link href={r.type === "dinner" ? "/dinners" : "/advisory-boards"}>
              View gathering
            </Link>
          </article>
        ))}
      </div>
    );
  } else if (s.type === "directory-preview") {
    const records = checked(
      await db.rpc("directory_search", {
        query: "",
        filters: [],
        location_query: "",
        page_number: 1,
      }),
    ) as DirectoryMember[];
    feed = (
      <div className="grid">
        {records.slice(0, 4).map((r) => (
          <article className="panel" key={r.user_id}>
            <h3>
              <Link href={`/members/${r.user_id}`}>{r.display_name}</Link>
            </h3>
            <p>{r.title}</p>
          </article>
        ))}
      </div>
    );
  } else if (s.type === "discussion-preview") {
    const records = checked(
      await db.rpc("discussion_feed", {
        search_query: "",
        saved_only: false,
        target_author: null,
        page_number: 1,
      }),
    ) as Thread[];
    feed = (
      <div className="grid">
        {records.slice(0, 4).map((r) => (
          <article className="panel" key={r.id}>
            <h3>
              <Link href={`/community/${r.id}`}>{r.title}</Link>
            </h3>
            <p>{r.author_name}</p>
          </article>
        ))}
      </div>
    );
  } else if (s.type === "cards") {
    feed = (
      <div className="grid">
        {s.cards.map((c, i) => (
          <article className="panel" key={i}>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
            {c.link && <Link href={c.link}>{c.label}</Link>}
          </article>
        ))}
      </div>
    );
  }
  return (
    <section
      data-section-id={s.id}
      className={`cms-section cms-theme-${s.theme} ${s.type === "hero" ? "page-hero" : "section"}`}
    >
      <div
        className={`cms-composition cms-image-${s.imagePosition} ${src ? "cms-has-image" : ""}`}
      >
        <header className="section-heading">
          {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
          <Title>{s.title}</Title>
          {s.body && <p className="lede cms-body">{s.body}</p>}
          {s.ctaLink && (
            <Link className="button" href={s.ctaLink}>
              {s.ctaLabel}
            </Link>
          )}
        </header>
        {src && (
          <img
            className="cms-image"
            src={src}
            alt={s.imageAlt || media?.alt || ""}
            style={
              {
                objectPosition: `${s.focalX ?? media?.focal_x ?? 50}% ${s.focalY ?? media?.focal_y ?? 50}%`,
              } as CSSProperties
            }
          />
        )}
      </div>
      {feed}
    </section>
  );
}
