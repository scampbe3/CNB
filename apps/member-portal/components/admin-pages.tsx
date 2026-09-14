import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, checked } from "@/lib/supabase";
import { ActionForm } from "./form";
import { Heading, Empty, Field, TextArea } from "./ui";
import type { Event, Profile, Resource } from "@/lib/types";
const sections = [
  "members",
  "invitations",
  "profiles",
  "resources",
  "media",
  "events",
  "discussions",
  "introductions",
  "sheet-publishing",
  "audit",
];
export async function AdminPage({
  section = "members",
  search = "",
  page = 1,
}: {
  section?: string;
  search?: string;
  page?: number;
}) {
  const { db, user } = await requireMember(true);
  if (!sections.includes(section)) notFound();
  let content: React.ReactNode;
  if (section === "members" || section === "profiles") {
    const members = checked(
      await db.rpc("admin_members", {
        query: search.slice(0, 200),
        page_number: page,
      }),
    ) as {
      user_id: string;
      email: string;
      display_name: string;
      status: string;
      role: string;
      directory_visible: boolean;
      total: number;
    }[];
    content = (
      <>
        <form className="search">
          <Field
            name="q"
            label="Search member name or email"
            defaultValue={search}
          />
          <button>Search</button>
          <Link href={`/admin/${section}`}>Clear</Link>
        </form>
        {members.map((m) => {
          const p = m;
          return (
            <article className="admin-item" key={m.user_id}>
              <h3>{p?.display_name || "Invited member"}</h3>
              <p className="status">
                {m.status} &middot; {m.role}
              </p>
              <code>{m.user_id}</code>
              <p className="muted">{m.email}</p>
              {section === "profiles" ? (
                <ActionForm
                  action="admin-profile"
                  label="Hide from directory"
                  confirm="Hide this member's profile? Only the member can opt back in."
                >
                  <input type="hidden" name="id" value={m.user_id} />
                  <p>
                    {p?.directory_visible
                      ? "Visible to members"
                      : "Hidden from the directory"}
                    . Directory participation is the member's choice.
                  </p>
                </ActionForm>
              ) : (
                m.user_id !== user.id && (
                  <ActionForm
                    action="admin-member"
                    label="Update membership"
                    confirm="Change this member's access?"
                  >
                    <input type="hidden" name="id" value={m.user_id} />
                    <label>
                      Access
                      <select
                        name="status"
                        defaultValue={
                          m.status === "invited" ? "suspended" : m.status
                        }
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="revoked">Revoked</option>
                      </select>
                    </label>
                    <Field name="reason" label="Reason (private)" required />
                  </ActionForm>
                )
              )}
            </article>
          );
        })}
        {!members.length && <Empty>No members match this search.</Empty>}
        <nav className="pagination" aria-label="Member administration pages">
          {page > 1 && (
            <Link href={`?q=${encodeURIComponent(search)}&page=${page - 1}`}>
              Previous
            </Link>
          )}
          <span>Page {page}</span>
          {Number(members[0]?.total) > page * 24 && (
            <Link href={`?q=${encodeURIComponent(search)}&page=${page + 1}`}>
              Next
            </Link>
          )}
        </nav>
      </>
    );
  } else if (section === "invitations") {
    const invites = checked(
      await db
        .from("member_invitations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    );
    content = (
      <>
        <div className="panel form-panel">
          <h2>Invite someone into the room.</h2>
          <ActionForm
            action="admin-invite"
            label="Send invitation"
            confirm="Send a membership invitation to this email address?"
          >
            <Field
              name="email"
              label="Approved member's email"
              type="email"
              required
            />
          </ActionForm>
        </div>
        <section className="section">
          {invites.map((i) => (
            <article key={i.id} className="admin-item">
              <h3>{i.email}</h3>
              <p>
                {i.accepted_at
                  ? "Accepted"
                  : new Date(i.expires_at) < new Date()
                    ? "Expired"
                    : "Awaiting acceptance"}
              </p>
              {!i.accepted_at && (
                <ActionForm
                  action="admin-invite"
                  label="Resend invitation"
                  confirm="Send a fresh access email to this invited member?"
                >
                  <input name="email" type="hidden" value={i.email} />
                </ActionForm>
              )}
            </article>
          ))}
        </section>
      </>
    );
  } else if (section === "resources") {
    const files = checked(
      await db
        .from("file_assets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    );
    const resources = checked(
      await db
        .from("resources")
        .select("id,title,status,access")
        .order("display_order")
        .limit(200),
    ) as Resource[];
    content = (
      <>
        <div className="panel form-panel">
          <h2>Private resource files</h2>
          <p>
            Upload a PDF, then paste its File Asset ID into the matching Library
            resource in the private workbook. PDF files must be under 3 MB.
          </p>
          <ActionForm action="admin-file" label="Upload PDF">
            <label>
              PDF file
              <input
                name="file"
                type="file"
                accept="application/pdf"
                required
              />
            </label>
          </ActionForm>
        </div>
        <section className="section">
          <h2>Uploaded files</h2>
          {files.map((f) => (
            <article key={f.id} className="admin-item">
              <p>{f.name}</p>
              <code>{f.id}</code>
            </article>
          ))}
        </section>
        <section className="section">
          <h2>Library publication</h2>
          {resources.map((r) => (
            <article key={r.id} className="admin-item">
              <h3>{r.title}</h3>
              <span className="status">
                {r.status} &middot; {r.access}
              </span>
            </article>
          ))}
        </section>
      </>
    );
  } else if (section === "media") {
    const media = checked(
      await db
        .from("editorial_media")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    );
    content = (
      <>
        <div className="panel form-panel">
          <h2>Images for your pages</h2>
          <p>
            Upload an image, then put its Image Asset ID in the Page Sections
            tab. Images stay private. JPEG, PNG or WebP; up to 3 MB.
          </p>
          <ActionForm action="admin-media" label="Upload image">
            <label>
              Image file
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </label>
            <Field
              name="alt"
              label="Describe the image for screen readers"
              required
              maxLength={500}
            />
          </ActionForm>
        </div>
        {media.map((m) => (
          <article className="admin-item" key={m.id}>
            <h3>{m.name}</h3>
            <img
              className="media-preview"
              src={`/api/media/${m.id}`}
              alt={m.alt}
              style={{ objectPosition: `${m.focal_x}% ${m.focal_y}%` }}
            />
            <p>
              Image Asset ID: <code>{m.id}</code>
              {m.archived && " (archived)"}
            </p>
            <ActionForm action="admin-media-edit" label="Save image details">
              <input name="id" type="hidden" value={m.id} />
              <Field
                name="alt"
                label="Image description"
                defaultValue={m.alt}
                required
                maxLength={500}
              />
              <Field
                name="focal_x"
                label="Horizontal focal point (0 left, 100 right)"
                type="number"
                min={0}
                max={100}
                defaultValue={m.focal_x}
                required
              />
              <Field
                name="focal_y"
                label="Vertical focal point (0 top, 100 bottom)"
                type="number"
                min={0}
                max={100}
                defaultValue={m.focal_y}
                required
              />
              <label className="check">
                <input
                  name="archived"
                  type="checkbox"
                  defaultChecked={m.archived}
                />
                Archive image (remove it from published sections first)
              </label>
            </ActionForm>
          </article>
        ))}
      </>
    );
  } else if (section === "events") {
    const events = checked(
      await db
        .from("events")
        .select("*")
        .order("starts_at", { ascending: false })
        .limit(100),
    ) as Event[];
    const details = checked(await db.from("event_details").select("*"));
    const profiles = checked(
      await db.from("member_profiles").select("user_id,display_name"),
    );
    const rsvps = checked(await db.from("event_rsvps").select("*"));
    content = events.length ? (
      <>
        {events.map((e) => {
          const d = details.find((d) => d.event_id === e.id);
          return (
            <article key={e.id} className="admin-item">
              <h3>{e.title}</h3>
              <p>
                {e.type} &middot; {e.status} &middot;{" "}
                {new Date(e.starts_at).toLocaleString("en-US", {
                  timeZone: e.timezone,
                })}{" "}
                {e.timezone}
              </p>
              <div className="split">
                <div>
                  <ActionForm
                    action="admin-event-details"
                    label="Save private details"
                  >
                    <input name="id" type="hidden" value={e.id} />
                    <Field
                      name="meeting_url"
                      label="Private meeting URL"
                      defaultValue={d?.meeting_url || ""}
                    />
                    <TextArea
                      name="instructions"
                      label="Private instructions or address"
                      defaultValue={d?.instructions || ""}
                      maxLength={5000}
                    />
                    <Field
                      name="resource_id"
                      label="Materials resource ID (optional)"
                      defaultValue={d?.materials_resource_id || ""}
                    />
                  </ActionForm>
                </div>
                <div>
                  <ActionForm action="admin-event-invite" label="Invite member">
                    <input name="id" type="hidden" value={e.id} />
                    <label>
                      Member
                      <select name="member_id" required>
                        {profiles.map((p) => (
                          <option key={p.user_id} value={p.user_id}>
                            {p.display_name || p.user_id}
                          </option>
                        ))}
                      </select>
                    </label>
                  </ActionForm>
                  <h3 className="section">Responses</h3>
                  {rsvps
                    .filter((r) => r.event_id === e.id)
                    .map((r) => (
                      <p key={r.member_id}>
                        {profiles.find((p) => p.user_id === r.member_id)
                          ?.display_name || "Member"}
                        : {r.response}
                        {r.dietary_note && (
                          <>
                            <br />
                            <small>{r.dietary_note}</small>
                          </>
                        )}
                      </p>
                    ))}
                  <a href={`/api/admin-export?event=${e.id}`}>
                    Download RSVP CSV
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </>
    ) : (
      <Empty>
        Create event copy and schedules in the private workbook, then publish
        them here.
      </Empty>
    );
  } else if (section === "discussions") {
    const threads = checked(
      await db
        .from("discussion_threads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    );
    const reports = checked(
      await db.from("discussion_reports").select("*").eq("resolved", false),
    );
    const comments = checked(
      await db
        .from("discussion_comments")
        .select("*")
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(100),
    );
    content = (
      <>
        <h2>Reports to review</h2>
        {reports.length ? (
          reports.map((r) => (
            <article className="admin-item" key={r.id}>
              <p>{r.reason}</p>
              <Link href={`/community/${r.thread_id}`}>Open conversation</Link>
              <ActionForm action="admin-report" label="Mark resolved">
                <input name="id" type="hidden" value={r.id} />
              </ActionForm>
            </article>
          ))
        ) : (
          <Empty>No unresolved reports.</Empty>
        )}
        <h2 className="section">Conversations</h2>
        {threads.map((t) => (
          <article key={t.id} className="admin-item">
            <h3>{t.title}</h3>
            <p className="reading">{t.body}</p>
            <ActionForm action="admin-thread" label="Update conversation">
              <input name="id" type="hidden" value={t.id} />
              <label>
                Status
                <select name="status" defaultValue={t.status}>
                  <option value="open">Open</option>
                  <option value="locked">Locked</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>
              <label className="check">
                <input
                  name="pinned"
                  type="checkbox"
                  defaultChecked={t.pinned}
                />
                Pin conversation
              </label>
            </ActionForm>
          </article>
        ))}
        <h2 className="section">Recent comments</h2>
        {comments.map((c) => (
          <article key={c.id} className="admin-item">
            <p>{c.body}</p>
            <ActionForm action="admin-comment" label="Hide comment">
              <input name="id" type="hidden" value={c.id} />
            </ActionForm>
          </article>
        ))}
      </>
    );
  } else if (section === "introductions") {
    const requests = checked(
      await db
        .from("introduction_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    );
    const profiles = checked(
      await db.from("member_profiles").select("user_id,display_name"),
    );
    content = requests.length ? (
      <>
        {requests.map((r) => (
          <article key={r.id} className="admin-item">
            <h3>
              {profiles.find((p) => p.user_id === r.requester_id)?.display_name}{" "}
              &rarr;{" "}
              {profiles.find((p) => p.user_id === r.target_id)?.display_name}
            </h3>
            <p>{r.context}</p>
            <ActionForm action="admin-intro" label="Update request">
              <input name="id" type="hidden" value={r.id} />
              <label>
                Status
                <select name="status" defaultValue={r.status}>
                  {["pending", "accepted", "declined", "completed"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <TextArea name="note" label="Private note" />
            </ActionForm>
          </article>
        ))}
      </>
    ) : (
      <Empty>No introduction requests yet.</Empty>
    );
  } else if (section === "sheet-publishing") {
    const revisions = checked(
      await db
        .from("cms_revisions")
        .select("id,source_hash,created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    );
    content = (
      <>
        <div className="panel">
          <h2>Your content, ready when you are.</h2>
          <p>
            Edit the private Google workbook, preview its changes, then publish
            a complete revision.
          </p>
          <div className="page-actions">
            <ActionForm action="admin-preview" label="Preview changes" />
            <ActionForm
              action="admin-publish"
              label="Publish workbook"
              confirm="Publish this workbook snapshot? Missing items will be archived."
            />
          </div>
        </div>
        <section className="section">
          <h2>Publication history</h2>
          <p>
            Visual previews require administrator login and show the current
            published-status rows from the workbook, without saving them.
          </p>
          <nav className="page-actions" aria-label="Page previews">
            {[
              "",
              "library",
              "directory",
              "advisory-boards",
              "community",
              "dinners",
            ].map((path) => (
              <Link key={path} href={`/${path}?cms_preview=1`}>
                {path || "Home"} preview
              </Link>
            ))}
          </nav>
          {revisions.map((r) => (
            <article key={r.id} className="admin-item">
              <p>{new Date(r.created_at).toLocaleString("en-US")}</p>
              <code>{r.id}</code>
              <ActionForm
                action="admin-rollback"
                label="Restore this revision"
                confirm="Restore this editorial revision? Newer content will be replaced."
              >
                <input name="id" type="hidden" value={r.id} />
                <Field
                  name="reason"
                  label="Reason for restoring (private)"
                  required
                  maxLength={1000}
                />
              </ActionForm>
            </article>
          ))}
        </section>
      </>
    );
  } else {
    const audit = checked(
      await db
        .from("audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    );
    const email = checked(
      await db
        .from("email_outbox")
        .select(
          "id,kind,sent_at,attempts,last_error,needs_review,delivery_unknown,next_attempt_at",
        )
        .is("sent_at", null)
        .is("skipped_at", null)
        .order("created_at")
        .limit(100),
    );
    content = (
      <>
        <h2>Email delivery</h2>
        <p>
          New event mail gets an immediate delivery attempt. The daily sweep and
          this button process pending mail within the delivery allowance. Failed
          or uncertain sends remain visible for review.
        </p>
        <ActionForm
          action="admin-send-email"
          label="Process pending email now"
        />
        {!email.length && <p>No pending email.</p>}
        {email.map((e) => (
          <article key={e.id} className="admin-item">
            <p>
              {e.kind}: {e.attempts} attempts {e.last_error || "Queued"}
            </p>
            {e.needs_review && (
              <ActionForm
                action="admin-review-email"
                label="Record delivery review"
                confirm="Have you checked the provider delivery log for this message ID? Retrying may send another email."
              >
                <p>
                  Provider idempotency key: <code>{e.id}</code>. Check the
                  Resend log before deciding whether to resend.
                </p>
                <input name="id" type="hidden" value={e.id} />
                <label>
                  Resolution
                  <select name="decision">
                    <option value="sent">Provider confirms delivery</option>
                    <option value="skip">Do not resend</option>
                    <option value="retry">
                      Provider confirms not sent: retry
                    </option>
                  </select>
                </label>
                <Field
                  name="reason"
                  label="Provider check and reason"
                  required
                  minLength={10}
                  maxLength={1000}
                />
              </ActionForm>
            )}
          </article>
        ))}
        <h2 className="section">Recent activity</h2>
        {audit.map((a) => (
          <article key={a.id} className="admin-item">
            <p>{a.action}</p>
            <code>{a.target || ""}</code>
            <p className="muted">
              {new Date(a.created_at).toLocaleString("en-US")}
            </p>
          </article>
        ))}
      </>
    );
  }
  return (
    <>
      <Heading title="Keep the room running." eyebrow="Administration" />
      <nav className="admin-nav" aria-label="Administration">
        {sections.map((s) => (
          <Link href={`/admin/${s}`} key={s}>
            {s.replaceAll("-", " ")}
          </Link>
        ))}
      </nav>
      {content}
    </>
  );
}
