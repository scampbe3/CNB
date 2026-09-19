import { notFound, redirect } from "next/navigation";
import { AuthPage } from "@/components/auth-page";
import {
  MemberPage,
  ResourceSearch,
  pageLink,
} from "@/components/member-pages";
import { AdminPage } from "@/components/admin-pages";
import { Shell, Heading, PageHero, ResourceCard, Empty } from "@/components/ui";
import { configured, database, requireMember, checked } from "@/lib/supabase";
import { resourceTypes } from "@/lib/validation";
import type { Resource } from "@/lib/types";
import { ActionForm } from "@/components/form";
import Link from "next/link";
import { PageSections } from "@/components/page-sections";
import { portalCopy } from "@/lib/copy";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path = [] } = await params;
  const query = await searchParams;
  const route = path.join("/");
  if (
    [
      "login",
      "forgot-password",
      "reset-password",
      "accept-invite",
      "auth/confirm",
      "onboarding",
      "account-status",
      "setup",
      "privacy",
      "terms",
    ].includes(route)
  )
    return <AuthPage route={route} query={query} />;
  if (!configured()) redirect("/setup");
  if (path[0] === "library") {
    const db = await database();
    const {
      data: { user },
    } = await db.auth.getUser();
    const { data: active } = user ? await db.rpc("is_active") : { data: false };
    const bookmarks = active
      ? checked(
          await db
            .from("saved_resources")
            .select("resource_id")
            .eq("member_id", user!.id),
        ).map((s) => s.resource_id)
      : [];
    if (path[1]) {
      const resource = checked(
        await db
          .from("resources")
          .select("*")
          .eq("slug", path[1])
          .maybeSingle(),
      ) as Resource | null;
      if (!resource) {
        if (!active)
          redirect(`/login?next=${encodeURIComponent(`/library/${path[1]}`)}`);
        notFound();
      }
      return (
        <Shell member={Boolean(active)}>
          <article className="article">
            <Link href="/library">&larr; The Library</Link>
            <Heading
              title={resource.title}
              eyebrow={resource.type}
              body={resource.summary}
            />
            {resource.image && (
              <img
                className="article-image"
                src={resource.image}
                alt={resource.image_alt}
              />
            )}
            <div className="article-body">{resource.body}</div>
            <p className="muted">{resource.author}</p>
            <div className="page-actions">
              {resource.file_asset_id && (
                <a className="button" href={`/api/resource/${resource.id}`}>
                  Download resource
                </a>
              )}
              {resource.external_url && (
                <a
                  className="button secondary"
                  href={resource.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open resource
                </a>
              )}
              {active && (
                <ActionForm
                  action="save"
                  label={
                    bookmarks.includes(resource.id)
                      ? "Remove bookmark"
                      : "Save resource"
                  }
                >
                  <input name="id" type="hidden" value={resource.id} />
                  <input
                    name="saved"
                    type="hidden"
                    value={String(bookmarks.includes(resource.id))}
                  />
                </ActionForm>
              )}
            </div>
          </article>
        </Shell>
      );
    }
    const copy = active
      ? await portalCopy()
      : (_section: string, _field: string, fallback: string) => fallback;
    const page = Math.max(
      1,
      Math.min(1000, Math.floor(Number(query.page) || 1)),
    );
    let request = db
      .from("resources")
      .select("*", { count: "exact" })
      .order("display_order")
      .order("published_at", { ascending: false })
      .range((page - 1) * 24, page * 24 - 1);
    if (typeof query.q === "string" && query.q.trim())
      request = request.textSearch("search_document", query.q.slice(0, 200), {
        type: "websearch",
        config: "english",
      });
    if (
      typeof query.type === "string" &&
      resourceTypes.includes(query.type as (typeof resourceTypes)[number])
    )
      request = request.eq("type", query.type);
    const result = await request;
    const resources = checked(result) as Resource[];
    return (
      <Shell member={Boolean(active)}>
        <PageSections
          page="library"
          enabled={Boolean(active)}
          preview={query.cms_preview === "1"}
        >
          <PageHero
            title={copy(
              "Portal Settings:library",
              "Title",
              "Ideas worth thinking about.",
            )}
            eyebrow="The Library"
            body={copy(
              "Portal Settings:library",
              "Subhead",
              "Essays, AI prompts, decision briefs and business cases for better questions and better decisions.",
            )}
            image="/images/library-hero.webp"
            imageAlt="Amanda reading and reflecting in the Library"
          />
          <ResourceSearch query={query} />
          {resources.length ? (
            <div className="grid">
              {resources.map((r) => (
                <ResourceCard
                  key={r.id}
                  resource={r}
                  saved={bookmarks.includes(r.id)}
                  member={Boolean(active)}
                />
              ))}
            </div>
          ) : (
            <Empty>
              No resources match this search. Try another topic or return soon
              for new reading.
            </Empty>
          )}
          <nav className="pagination" aria-label="Library pages">
            {page > 1 && <Link href={pageLink(query, page - 1)}>Previous</Link>}
            <span>Page {page}</span>
            {(result.count || 0) > page * 24 && (
              <Link href={pageLink(query, page + 1)}>Next</Link>
            )}
          </nav>
          {!active && (
            <p className="section">
              <Link href="/login">Log in</Link> to open member resources and
              keep a personal collection.
            </p>
          )}
        </PageSections>
      </Shell>
    );
  }
  const context = await requireMember(path[0] === "admin");
  return (
    <Shell>
      {path[0] === "admin" ? (
        <AdminPage
          section={path[1]}
          search={typeof query.q === "string" ? query.q : ""}
          page={Math.max(
            1,
            Math.min(1000, Math.floor(Number(query.page) || 1)),
          )}
        />
      ) : (
        <MemberPage path={path} query={query} />
      )}
    </Shell>
  );
}
