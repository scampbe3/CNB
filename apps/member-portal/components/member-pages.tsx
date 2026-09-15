import Link from "next/link";
import { PageSections } from "./page-sections";
import { notFound, redirect } from "next/navigation";
import { requireMember, checked } from "@/lib/supabase";
import { ActionForm } from "./form";
import {
  Heading,
  PageHero,
  Empty,
  Field,
  TextArea,
  ResourceCard,
  ProfileFields,
} from "./ui";
import type {
  DirectoryMember,
  Profile,
  Resource,
  Term,
  Event,
  Thread,
  DiscussionReply,
  Intro,
} from "@/lib/types";
import { resourceTypes, uuid } from "@/lib/validation";
import { portalCopy } from "@/lib/copy";
import { SavedLibrary } from "./saved-library";
type Query = Record<string, string | string[] | undefined>;
const q = (query: Query, key: string) =>
  typeof query[key] === "string" ? (query[key] as string) : "";
export async function MemberPage({
  path,
  query,
}: {
  path: string[];
  query: Query;
}) {
  const { db, user } = await requireMember();
  const copy = await portalCopy();
  const route = path[0] || "home";
  if (route === "home") {
    const content = checked(
      await db.from("portal_content").select("section,fields"),
    ) as { section: string; fields: Record<string, string> }[];
    const hero =
      content.find((c) => c.section === "member-home:hero")?.fields || {};
    const [events, intros] = await Promise.all([
      db
        .from("events")
        .select("*")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(3),
      db
        .from("introduction_requests")
        .select("id", { count: "exact", head: true })
        .eq("requester_id", user.id)
        .eq("status", "pending"),
    ]);
    checked(events);
    checked(intros);
    return (
      <PageSections page="home" preview={query.cms_preview === "1"}>
        <PageHero
          title={hero.Title || "Welcome back."}
          eyebrow={hero.Note || "The Decision Room"}
          body={hero.Subhead || "What decision are you thinking through today?"}
          image={hero.Image || "/images/member-home-landscape.webp"}
          imageAlt={hero["Image Alt"] || "The Decision Room member artwork"}
        />
        <section className="section grid">
          <article className="feature-card ink">
            <p className="eyebrow">A little perspective</p>
            <h2>{copy("member-home:the-library", "Title", "The Library")}</h2>
            <p>
              {copy(
                "member-home:the-library",
                "Paragraph 1",
                "Explore essays, decision briefs, AI prompts and member resources.",
              )}
            </p>
            <Link className="button" href="/library">
              {copy("member-home:the-library", "Button 1", "Open Library")}{" "}
              &rarr;
            </Link>
          </article>
          <article className="feature-card">
            <p className="eyebrow">Your personal board of directors</p>
            <h2>{copy("member-home:in-the-room", "Title", "In the Room")}</h2>
            <p>
              {copy(
                "member-home:in-the-room",
                "Paragraph 1",
                "One of the greatest strengths of The Decision Room is the women inside it.",
              )}
            </p>
            <Link className="text-link" href="/directory">
              {copy("member-home:in-the-room", "Button 1", "Meet the members")}{" "}
              &rarr;
            </Link>
          </article>
        </section>
        <section className="section">
          <div className="section-bar">
            <h2>Coming together</h2>
            <Link href="/advisory-boards">All gatherings</Link>
          </div>
          {events.data?.length ? (
            <div className="grid">
              {(events.data as Event[]).map((event) => (
                <article className="event-card" key={event.id}>
                  <p className="event-date">
                    {new Date(event.starts_at).toLocaleDateString("en-US", {
                      dateStyle: "long",
                      timeZone: event.timezone,
                    })}
                  </p>
                  <h3>{event.title}</h3>
                  <Link
                    href={
                      event.type === "board" ? "/advisory-boards" : "/dinners"
                    }
                  >
                    View gathering &rarr;
                  </Link>
                </article>
              ))}
              <figure className="home-gathering-image">
                <img
                  src="/images/coming-together.webp"
                  alt="Amanda in conversation with fellow leaders"
                />
              </figure>
            </div>
          ) : (
            <Empty>
              Your next gathering will appear here when it is scheduled.
            </Empty>
          )}
        </section>
        <section className="section grid">
          <article className="panel">
            <h3>Confidential discussions.</h3>
            <p>Bring a question. Share a perspective. Listen closely.</p>
            <Link href="/community">Join the discussion &rarr;</Link>
          </article>
          <article className="panel">
            <h3>Meaningful introductions.</h3>
            <p>
              {intros.count
                ? `${intros.count} request${intros.count === 1 ? "" : "s"} with Amanda.`
                : "Find someone you would like to know, and ask Amanda to make the connection."}
            </p>
            <Link href="/account#introduction-requests">
              Your introduction requests &rarr;
            </Link>
          </article>
        </section>
      </PageSections>
    );
  }
  if (route === "directory") {
    const terms = checked(
      await db
        .from("taxonomy_terms")
        .select("*")
        .eq("active", true)
        .order("display_order"),
    ) as Term[];
    const raw = query.term;
    const filters = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
      (s) => uuid.safeParse(s).success,
    );
    const page = Math.max(1, Math.min(1000, Number(q(query, "page")) || 1));
    const people = checked(
      await db.rpc("directory_search", {
        query: q(query, "q").slice(0, 200),
        filters,
        location_query: q(query, "location").slice(0, 100),
        page_number: page,
      }),
    ) as DirectoryMember[];
    return (
      <PageSections page="directory" preview={query.cms_preview === "1"}>
        <PageHero
          title={copy("Portal Settings:directory", "Title", "In the Room")}
          body={copy(
            "Portal Settings:directory",
            "Subhead",
            "Search by profession, education, location or sorority to discover members you may want to meet, learn from or simply get to know.",
          )}
          image="/images/directory-hero.webp"
          imageAlt="A portrait from The Decision Room collection"
        />
        <form>
          <div className="search">
            <Field
              name="q"
              label="Search members"
              defaultValue={q(query, "q")}
            />
            <Field
              name="location"
              label="Location"
              defaultValue={q(query, "location")}
            />
            <button>Search</button>
            <Link href="/directory">Clear all</Link>
          </div>
          <div className="filter-grid">
            {[
              ["profession", "Profession"],
              ["institution", "Education"],
              ["sorority", "Sorority"],
              ["military_service", "Military service"],
            ].map(([kind, label]) => (
              <fieldset key={kind}>
                <legend>{label}</legend>
                <div className="check-options">
                  {terms
                    .filter(
                      (t) =>
                        t.kind === kind ||
                        (kind === "institution" &&
                          t.kind === "education_group"),
                    )
                    .map((t) => (
                      <label className="check" key={t.id}>
                        <input
                          type="checkbox"
                          name="term"
                          value={t.id}
                          defaultChecked={filters.includes(t.id)}
                        />
                        {t.label}
                      </label>
                    ))}
                  {!terms.some((t) => t.kind === kind) && (
                    <span className="muted">No options yet.</span>
                  )}
                </div>
              </fieldset>
            ))}
          </div>
        </form>
        <p className="muted" role="status">
          {people[0]?.total || 0} members found
        </p>
        {people.length ? (
          <div className="grid three">
            {people.map((p) => (
              <article className="member-card" key={p.user_id}>
                {p.avatar_path ? (
                  <img
                    className="avatar"
                    src={`/api/avatar/${p.user_id}`}
                    alt={p.display_name}
                  />
                ) : (
                  <div className="avatar-initial" aria-hidden="true">
                    {p.display_name.charAt(0)}
                  </div>
                )}
                <h3>
                  <Link href={`/members/${p.user_id}`}>{p.display_name}</Link>
                </h3>
                <p>{[p.title, p.company].filter(Boolean).join(", ")}</p>
                <p className="muted">
                  {[p.city, p.region].filter(Boolean).join(", ")}
                </p>
                <div className="tags">
                  {p.tags.slice(0, 4).map((t) => (
                    <span className="tag" key={t.id}>
                      {t.label}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty>
            No members match those filters. Try fewer filters or a broader
            search.
          </Empty>
        )}
        <div className="pagination">
          {page > 1 && <Link href={pageLink(query, page - 1)}>Previous</Link>}
          <span>Page {page}</span>
          {Number(people[0]?.total) > page * 24 && (
            <Link href={pageLink(query, page + 1)}>Next</Link>
          )}
        </div>
      </PageSections>
    );
  }
  if (route === "members") {
    if (!uuid.safeParse(path[1]).success) notFound();
    const p = checked(
      await db
        .from("member_profiles")
        .select(
          "user_id,display_name,title,company,bio,city,region,country,avatar_path,directory_visible,onboarding_complete",
        )
        .eq("user_id", path[1])
        .maybeSingle(),
    ) as Profile | null;
    if (!p) notFound();
    const selected = checked(
      await db
        .from("member_taxonomy_terms")
        .select("taxonomy_terms(label,kind)")
        .eq("member_id", p.user_id),
    );
    const tags = selected.flatMap((row) =>
      Array.isArray(row.taxonomy_terms)
        ? row.taxonomy_terms
        : row.taxonomy_terms
          ? [row.taxonomy_terms]
          : [],
    ) as { label: string; kind: string }[];
    const authored = checked(
      await db.rpc("discussion_feed", {
        search_query: "",
        saved_only: false,
        target_author: p.user_id,
        page_number: 1,
      }),
    ) as Thread[];
    return (
      <>
        <Link href="/directory" className="text-link">
          &larr; In the Room
        </Link>
        <section className="section profile-header">
          {p.avatar_path && (
            <img
              className="avatar"
              src={`/api/avatar/${p.user_id}`}
              alt={p.display_name}
            />
          )}
          <div>
            <h1>{p.display_name}</h1>
            <p>{[p.title, p.company].filter(Boolean).join(", ")}</p>
            <div className="tags">
              {tags.map((t) => (
                <span className="tag" key={`${t.kind}:${t.label}`}>
                  {t.label}
                </span>
              ))}
            </div>
            <p className="muted">
              {[p.city, p.region, p.country].filter(Boolean).join(", ")}
            </p>
          </div>
        </section>
        <section className="section article">
          <h2>About</h2>
          <p className="reading">
            {p.bio || "This member is still writing her introduction."}
          </p>
        </section>
        <section className="section">
          <div className="section-bar">
            <h2>In the conversation</h2>
            <span className="muted">
              {authored.length} conversation{authored.length === 1 ? "" : "s"}
            </span>
          </div>
          {authored.length ? (
            <div className="discussion-grid">
              {authored.map((thread) => (
                <DiscussionCard thread={thread} key={thread.id} />
              ))}
            </div>
          ) : (
            <Empty>This member has not started a conversation yet.</Empty>
          )}
        </section>
        {p.user_id === user.id ? (
          <section className="section">
            <div className="page-actions">
              <Link className="button" href="/profile/edit">
                Edit profile
              </Link>
              <a className="button secondary" href="#saved-library">
                Jump to saved resources
              </a>
            </div>
            <h2 className="section" id="saved-library">
              Saved from the Library
            </h2>
            <p>Everything you have bookmarked from the Library lives here.</p>
            <SavedLibrary query={query} />
          </section>
        ) : (
          <>
            <section className="section panel form-panel">
              <h2>Make a connection.</h2>
              <p>Tell Amanda why you would like an introduction.</p>
              <ActionForm action="intro" label="Request an introduction">
                <input type="hidden" name="id" value={p.user_id} />
                <TextArea
                  name="context"
                  label="What would you like to discuss?"
                  maxLength={2000}
                  required
                />
              </ActionForm>
            </section>
            <details className="section report-panel">
              <summary>Report this member</summary>
              <ActionForm action="report" label="Send private report">
                <input name="id" type="hidden" value={p.user_id} />
                <input name="target_type" type="hidden" value="member" />
                <TextArea
                  name="reason"
                  label="What should Amanda know?"
                  required
                  maxLength={1000}
                />
              </ActionForm>
            </details>
          </>
        )}
      </>
    );
  }
  if (route === "profile") {
    const p = checked(
      await db
        .from("member_profiles")
        .select(
          "user_id,display_name,title,company,bio,city,region,country,avatar_path,directory_visible,onboarding_complete",
        )
        .eq("user_id", user.id)
        .single(),
    ) as Profile;
    const terms = checked(
      await db
        .from("taxonomy_terms")
        .select("*")
        .eq("active", true)
        .order("display_order"),
    ) as Term[];
    const selected = checked(
      await db
        .from("member_taxonomy_terms")
        .select("term_id")
        .eq("member_id", user.id),
    ).map((t) => t.term_id);
    return (
      <>
        <Heading title="Your story, in your words." eyebrow="Edit profile" />
        <div className="panel form-panel">
          <ActionForm action="profile" label="Save profile">
            <ProfileFields profile={p} terms={terms} selected={selected} />
          </ActionForm>
        </div>
        <section className="section panel form-panel">
          <h2>Your photograph</h2>
          <p>Choose a clear portrait. JPEG, PNG or WebP, up to 3 MB.</p>
          {p.avatar_path && (
            <img
              className="avatar"
              src={`/api/avatar/${user.id}`}
              alt="Your current profile photo"
            />
          )}
          <ActionForm action="avatar" label="Update photograph">
            <label>
              Profile photograph
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </label>
          </ActionForm>
        </section>
      </>
    );
  }
  if (route === "saved") {
    redirect(`/members/${user.id}#saved-library`);
  }
  if (route === "advisory-boards" || route === "dinners") {
    const events = checked(
      await db
        .from("events")
        .select("*")
        .eq("type", route === "dinners" ? "dinner" : "board")
        .gte("ends_at", new Date().toISOString())
        .order("starts_at"),
    ) as Event[];
    const rsvps = checked(
      await db
        .from("event_rsvps")
        .select("event_id,response,dietary_note")
        .eq("member_id", user.id),
    );
    const details = checked(await db.from("event_details").select("*"));
    return (
      <PageSections page={route} preview={query.cms_preview === "1"}>
        <PageHero
          title={
            route === "dinners"
              ? "A seat at the table."
              : "Monthly advisory boards."
          }
          eyebrow={
            route === "dinners"
              ? "Invitation-only dinners"
              : "A little collective wisdom"
          }
          body={
            route === "dinners"
              ? "Your personal invitations and the details for each gathering."
              : "Bring the decision you are working through. Think it through with the room."
          }
          image={
            route === "dinners"
              ? "/images/dinners-hero.webp"
              : "/images/advisory-boards-hero.webp"
          }
          imageAlt={
            route === "dinners"
              ? "Guests gathered around a Blind Dinner table"
              : "Amanda speaking during a thoughtful panel conversation"
          }
        />
        {events.length ? (
          <div className="grid">
            {events.map((e) => {
              const r = rsvps.find((r) => r.event_id === e.id);
              const d = details.find((d) => d.event_id === e.id);
              return (
                <article className="event-card" key={e.id}>
                  <p className="event-date">
                    <LocalEventDate event={e} />
                  </p>
                  <h3>{e.title}</h3>
                  <p>{e.description}</p>
                  <p className="muted">
                    {e.location_label}{" "}
                    {e.status === "cancelled" ? " | Cancelled" : ""}
                  </p>
                  {d && (
                    <div className="details">
                      <p>{d.instructions}</p>
                      {d.meeting_url && (
                        <p>
                          <a
                            href={d.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Join the gathering &rarr;
                          </a>
                        </p>
                      )}
                      {d.materials_resource_id && (
                        <a href={`/api/resource/${d.materials_resource_id}`}>
                          Open materials
                        </a>
                      )}
                    </div>
                  )}
                  {e.status === "published" && (
                    <>
                      <a className="text-link" href={`/api/calendar/${e.id}`}>
                        Add to calendar
                      </a>
                      <p className="status">
                        {r ? `Your RSVP: ${r.response}` : "RSVP requested"}
                      </p>
                      <ActionForm action="rsvp" label="Update RSVP">
                        <input type="hidden" name="id" value={e.id} />
                        <label>
                          Your response
                          <select
                            name="answer"
                            defaultValue={r?.response === "no" ? "no" : "yes"}
                          >
                            <option value="yes">I would love to join</option>
                            <option value="no">I cannot make it</option>
                          </select>
                        </label>
                        {route === "dinners" && (
                          <TextArea
                            name="note"
                            label="Dietary requirements (private)"
                            defaultValue={r?.dietary_note}
                            maxLength={500}
                          />
                        )}
                      </ActionForm>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <Empty>
            {route === "dinners"
              ? "You have no upcoming dinner invitations. Amanda will let you know when a seat is waiting."
              : "Your next advisory board will appear here when it is scheduled."}
          </Empty>
        )}
      </PageSections>
    );
  }
  if (route === "community") {
    const guidelines = copy("Portal Settings:community", "Guidelines URL", "");
    if (path[1]) {
      if (!uuid.safeParse(path[1]).success) notFound();
      const thread = checked(
        await db.rpc("discussion_detail", { target: path[1] }).maybeSingle(),
      ) as Thread | null;
      if (!thread) notFound();
      const comments = checked(
        await db.rpc("discussion_replies", { target: thread.id }),
      ) as DiscussionReply[];
      return (
        <>
          <Link href="/community">&larr; Discussions</Link>
          <section className="section">
            <Heading
              title={thread.title}
              eyebrow={
                thread.status === "locked"
                  ? "Discussion closed"
                  : "In discussion"
              }
            />
            <div className="discussion-author">
              <MemberAvatar
                id={thread.author_id}
                name={thread.author_name}
                path={thread.author_avatar_path}
              />
              <p>
                {thread.author_name === "A member" ? (
                  thread.author_name
                ) : (
                  <Link href={`/members/${thread.author_id}`}>
                    {thread.author_name}
                  </Link>
                )}
                <small className="muted">
                  {new Date(thread.created_at).toLocaleDateString("en-US", {
                    dateStyle: "long",
                  })}
                </small>
              </p>
            </div>
            <p className="reading">{thread.body}</p>
            <div className="discussion-actions">
              <ActionForm
                action="discussion-appreciate"
                label={
                  thread.appreciated
                    ? "Remove appreciation"
                    : "I found this thoughtful"
                }
                className="compact"
              >
                <input name="id" type="hidden" value={thread.id} />
                <input
                  name="active"
                  type="hidden"
                  value={String(thread.appreciated)}
                />
              </ActionForm>
              <ActionForm
                action="discussion-save"
                label={thread.saved ? "Unsave" : "Save"}
                className="compact"
              >
                <input name="id" type="hidden" value={thread.id} />
                <input
                  name="active"
                  type="hidden"
                  value={String(thread.saved)}
                />
              </ActionForm>
              <span className="muted">
                {thread.appreciation_count} thoughtful &middot;{" "}
                {thread.reply_count} responses
              </span>
            </div>
            {thread.author_id === user.id && thread.status === "open" && (
              <ContributionEditor
                kind="thread"
                id={thread.id}
                body={thread.body}
                title={thread.title}
              />
            )}
          </section>
          <section className="section">
            <h2>In response</h2>
            <DiscussionReplies
              comments={comments}
              currentUser={user.id}
              open={thread.status === "open"}
              guidelines={Boolean(guidelines)}
              threadId={thread.id}
            />
            {!comments.length && (
              <Empty>There is room for your perspective.</Empty>
            )}
            {thread.status === "open" && guidelines && (
              <ActionForm action="comment" label="Share your response">
                <input name="id" type="hidden" value={thread.id} />
                <TextArea
                  name="body"
                  label="Your response"
                  required
                  maxLength={5000}
                />
              </ActionForm>
            )}
            <details className="section">
              <summary>Report this conversation</summary>
              <ActionForm action="report" label="Send report to Amanda">
                <input name="id" type="hidden" value={thread.id} />
                <input name="target_type" type="hidden" value="thread" />
                <TextArea
                  name="reason"
                  label="What should Amanda know?"
                  required
                  maxLength={1000}
                />
              </ActionForm>
            </details>
          </section>
        </>
      );
    }
    const page = Math.max(1, Math.min(1000, Number(q(query, "page")) || 1));
    const savedOnly = q(query, "saved") === "true";
    const threads = checked(
      await db.rpc("discussion_feed", {
        search_query: q(query, "q").slice(0, 200),
        saved_only: savedOnly,
        target_author: null,
        page_number: page,
      }),
    ) as Thread[];
    return (
      <PageSections page="community" preview={query.cms_preview === "1"}>
        <PageHero
          title={copy(
            "Portal Settings:community",
            "Title",
            "Confidential discussions.",
          )}
          eyebrow="Private community"
          body={copy(
            "Portal Settings:community",
            "Subhead",
            "Keep what is shared here in the room. Be thoughtful, respectful, and generous with one another.",
          )}
          image="/images/discussions-hero.webp"
          imageAlt="Guests engaged in conversation around a shared table"
        />
        {guidelines ? (
          <>
            <p className="muted">
              <a href={guidelines} target="_blank" rel="noopener noreferrer">
                Read our community guidelines
              </a>{" "}
              before sharing.
            </p>
            <details className="panel">
              <summary>Start a conversation</summary>
              <ActionForm action="thread" label="Open the conversation">
                <Field
                  name="title"
                  label="Your question or topic"
                  required
                  maxLength={200}
                />
                <TextArea
                  name="body"
                  label="Give the room a little context"
                  required
                  maxLength={10000}
                />
              </ActionForm>
            </details>
          </>
        ) : (
          <Empty>
            Discussions will open once Amanda publishes the community
            guidelines.
          </Empty>
        )}
        <form className="search discussion-search">
          <Field
            name="q"
            label="Search conversations"
            defaultValue={q(query, "q")}
          />
          <label className="check saved-filter">
            <input
              type="checkbox"
              name="saved"
              value="true"
              defaultChecked={savedOnly}
            />
            Saved only
          </label>
          <button>Search</button>
          <Link href="/community">Clear</Link>
        </form>
        <section className="section">
          {threads.length ? (
            <div className="discussion-grid">
              {threads.map((thread) => (
                <DiscussionCard thread={thread} key={thread.id} />
              ))}
            </div>
          ) : (
            <Empty>
              The first conversation starts with a thoughtful question.
            </Empty>
          )}
          <div className="pagination">
            {page > 1 && <Link href={pageLink(query, page - 1)}>Previous</Link>}
            <span>Page {page}</span>
            {Number(threads[0]?.total) > page * 24 && (
              <Link href={pageLink(query, page + 1)}>Next</Link>
            )}
          </div>
        </section>
      </PageSections>
    );
  }
  if (route === "introductions") {
    redirect("/account#introduction-requests");
  }
  if (route === "account") {
    const requests = checked(
      await db
        .from("introduction_requests")
        .select("*")
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false }),
    ) as Intro[];
    const warnings = checked(
      await db
        .from("member_warnings")
        .select("id,message,created_at")
        .eq("member_id", user.id)
        .is("withdrawn_at", null)
        .order("created_at", { ascending: false }),
    );
    return (
      <>
        <Heading title="Your account." />
        <div className="page-actions">
          <Link className="button" href={`/members/${user.id}`}>
            View profile
          </Link>
          <Link className="button" href="/profile/edit">
            Edit profile
          </Link>
          <a className="button secondary" href="/api/account-export">
            Download my information
          </a>
        </div>
        {warnings.length > 0 && (
          <section
            className="section moderation-notices"
            aria-labelledby="account-notices-title"
          >
            <p className="eyebrow">Private notices from Amanda</p>
            <h2 id="account-notices-title">Account notices</h2>
            {warnings.map((warning) => (
              <article className="panel" key={warning.id}>
                <p className="status">
                  {new Date(warning.created_at).toLocaleDateString("en-US", {
                    dateStyle: "long",
                  })}
                </p>
                <p className="reading">{warning.message}</p>
              </article>
            ))}
          </section>
        )}
        <section className="section" id="introduction-requests">
          <div className="section-bar">
            <div>
              <p className="eyebrow">Curated introductions</p>
              <h2>Introduction requests</h2>
            </div>
            <Link href="/directory">Explore In the Room</Link>
          </div>
          <p>
            Find someone in the directory you would like to know. Amanda will
            help make the introduction.
          </p>
          {requests.length ? (
            <div className="grid">
              {requests.map((request) => (
                <article className="panel" key={request.id}>
                  <p className="status">{request.status}</p>
                  <p>{request.context}</p>
                  <Link href={`/members/${request.target_id}`}>
                    View member
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <Empty>Your introduction requests will appear here.</Empty>
          )}
        </section>
        <section className="section panel form-panel">
          <h2>Change password</h2>
          <ActionForm action="password" label="Update password">
            <Field
              name="current_password"
              label="Current password"
              type="password"
              required
            />
            <Field
              name="password"
              label="New password"
              type="password"
              required
            />
            <Field
              name="confirm_password"
              label="Confirm new password"
              type="password"
              required
            />
          </ActionForm>
        </section>
        <section className="section panel form-panel">
          <h2>Manage access</h2>
          <p>
            Sign out your other sessions, or contact Amanda about membership and
            account deletion.
          </p>
          <ActionForm action="sessions" label="Sign out other sessions" />
          <p className="section">
            <a href="mailto:amanda@cupcakesandbroccoli.com?subject=Decision%20Room%20account%20request">
              Contact Amanda about my account
            </a>
          </p>
          <ActionForm action="logout" label="Log out" />
        </section>
      </>
    );
  }
  notFound();
}

function MemberAvatar({
  id,
  name,
  path,
}: {
  id: string;
  name: string;
  path: string | null;
}) {
  return path ? (
    <img className="conversation-avatar" src={`/api/avatar/${id}`} alt="" />
  ) : (
    <span className="conversation-initial" aria-hidden="true">
      {name.charAt(0)}
    </span>
  );
}

function DiscussionCard({ thread }: { thread: Thread }) {
  return (
    <article className={`thread panel${thread.pinned ? " featured" : ""}`}>
      <div className="discussion-card-top">
        <p className="eyebrow">
          {thread.pinned
            ? "From Amanda"
            : thread.status === "locked"
              ? "Closed conversation"
              : "In the room"}
        </p>
        <span className="muted">
          {new Date(thread.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
      <h3>
        <Link href={`/community/${thread.id}`}>{thread.title}</Link>
      </h3>
      <p>
        {thread.body.slice(0, 220)}
        {thread.body.length > 220 ? "..." : ""}
      </p>
      <div className="discussion-card-foot">
        <div className="discussion-author compact-author">
          <MemberAvatar
            id={thread.author_id}
            name={thread.author_name}
            path={thread.author_avatar_path}
          />
          {thread.author_name === "A member" ? (
            <span>{thread.author_name}</span>
          ) : (
            <Link href={`/members/${thread.author_id}`}>
              {thread.author_name}
            </Link>
          )}
        </div>
        <span className="muted">
          {thread.reply_count} responses &middot; {thread.appreciation_count}{" "}
          thoughtful
        </span>
      </div>
    </article>
  );
}

function DiscussionReplies({
  comments,
  currentUser,
  open,
  guidelines,
  threadId,
}: {
  comments: DiscussionReply[];
  currentUser: string;
  open: boolean;
  guidelines: boolean;
  threadId: string;
}) {
  const children = new Map<string | null, DiscussionReply[]>();
  for (const comment of comments) {
    const parent =
      comment.parent_id &&
      comments.some((item) => item.id === comment.parent_id)
        ? comment.parent_id
        : null;
    children.set(parent, [...(children.get(parent) || []), comment]);
  }
  const render = (comment: DiscussionReply, depth = 0) => (
    <div className="reply-branch" key={comment.id}>
      <article className="comment">
        <div className="discussion-author compact-author">
          <MemberAvatar
            id={comment.author_id}
            name={comment.author_name}
            path={comment.author_avatar_path}
          />
          <p>
            {comment.author_name === "A member" ? (
              comment.author_name
            ) : (
              <Link href={`/members/${comment.author_id}`}>
                {comment.author_name}
              </Link>
            )}
            <small className="muted">
              {new Date(comment.created_at).toLocaleDateString("en-US")}
              {comment.edited_at ? " · Edited" : ""}
            </small>
          </p>
        </div>
        <p>{comment.body}</p>
        <div className="comment-tools">
          {comment.author_id === currentUser && open && (
            <ContributionEditor
              kind="comment"
              id={comment.id}
              body={comment.body}
            />
          )}
          {open && guidelines && (
            <details className="reply-composer">
              <summary>Reply to {comment.author_name}</summary>
              <ActionForm action="comment" label="Share reply">
                <input name="id" type="hidden" value={threadId} />
                <input name="parent_id" type="hidden" value={comment.id} />
                <TextArea
                  name="body"
                  label="Your reply"
                  required
                  maxLength={5000}
                />
              </ActionForm>
            </details>
          )}
          {comment.author_id !== currentUser && (
            <details className="reply-report">
              <summary>Report response</summary>
              <ActionForm action="report" label="Send private report">
                <input name="id" type="hidden" value={comment.id} />
                <input name="target_type" type="hidden" value="comment" />
                <TextArea
                  name="reason"
                  label="What should Amanda know?"
                  required
                  maxLength={1000}
                />
              </ActionForm>
            </details>
          )}
        </div>
      </article>
      {(children.get(comment.id) || []).length > 0 && (
        <div className={`reply-children${depth >= 2 ? " deep" : ""}`}>
          {(children.get(comment.id) || []).map((item) =>
            render(item, depth + 1),
          )}
        </div>
      )}
    </div>
  );
  return <>{(children.get(null) || []).map((comment) => render(comment))}</>;
}

export function ResourceSearch({ query }: { query: Query }) {
  return (
    <form className="search">
      <Field name="q" label="Search resources" defaultValue={q(query, "q")} />
      <label>
        Resource type
        <select name="type" defaultValue={q(query, "type")}>
          <option value="">All</option>
          {resourceTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <button>Search</button>
      <Link href="?">Clear</Link>
    </form>
  );
}
export function pageLink(query: Query, page: number) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (k !== "page" && v)
      (Array.isArray(v) ? v : [v]).forEach((s) => params.append(k, s));
  });
  params.set("page", String(page));
  return `?${params}`;
}
import { LocalEventDate } from "./time";

function ContributionEditor({
  kind,
  id,
  body,
  title,
}: {
  kind: "thread" | "comment";
  id: string;
  body: string;
  title?: string;
}) {
  return (
    <details className="section contribution-editor">
      <summary>
        Edit your {kind === "thread" ? "conversation" : "response"}
      </summary>
      <ActionForm action="edit-discussion" label="Save changes">
        <input name="id" type="hidden" value={id} />
        <input name="kind" type="hidden" value={kind} />
        {kind === "thread" && (
          <Field
            name="title"
            label="Title"
            defaultValue={title}
            maxLength={200}
            required
          />
        )}
        <TextArea
          name="body"
          label="Your contribution"
          defaultValue={body}
          maxLength={kind === "thread" ? 10000 : 5000}
          required
        />
      </ActionForm>
      <ActionForm
        action="edit-discussion"
        label="Remove your contribution"
        confirm="Remove this contribution from the room?"
      >
        <input name="id" type="hidden" value={id} />
        <input name="kind" type="hidden" value={kind} />
        <input name="remove" type="hidden" value="true" />
      </ActionForm>
    </details>
  );
}
