import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
let db: PGlite;
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002",
  admin = "10000000-0000-4000-8000-000000000003";
async function asUser(id: string | null, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({
      sub: id,
      session_id: id,
      iat: Math.floor(Date.now() / 1000),
    }),
  ]);
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text default 'test-only-hash');
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role; grant execute on all functions in schema auth to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text,name text); alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;`);
  for (const file of [
    "202609140001_portal.sql",
    "202609140002_publishing_storage.sql",
    "202609140003_delivery.sql",
    "202609140004_security_workflows.sql",
    "202609140005_admin_and_catalog.sql",
    "202609140006_atomic_restore.sql",
    "202609140007_member_conversations.sql",
    "202609140008_daily_delivery.sql",
    "202609140009_editorial_media.sql",
  ])
    await db.exec(
      readFileSync(resolve("../../supabase/migrations", file), "utf8"),
    );
  await db.exec(readFileSync(resolve("../../supabase/seed.sql"), "utf8"));
  for (const [id, email] of [
    [a, "a@example.test"],
    [b, "b@example.test"],
    [admin, "admin@example.test"],
  ]) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [id, email],
    );
    await db.query("insert into auth.sessions(id,user_id) values($1,$1)", [id]);
    await db.query(
      "insert into public.memberships(user_id,status,role) values($1,'active',$2)",
      [id, id === admin ? "admin" : "member"],
    );
    await db.query(
      "insert into public.member_profiles(user_id,display_name,directory_visible,onboarding_complete) values($1,$2,true,true)",
      [id, email],
    );
  }
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("editorial assets are private until referenced by a published section", async () => {
  const asset = "80000000-0000-4000-8000-000000000001",
    section = "page-sections:media-test";
  await db.query(
    "insert into public.editorial_media(id,path,name,alt,bytes,width,height) values($1,'test.webp','Test','A discussion',1000,1000,600)",
    [asset],
  );
  expect(
    (await asUser(a, "select * from public.editorial_media")).rows,
  ).toHaveLength(0);
  await db.query("insert into public.portal_content values($1,$2::jsonb)", [
    section,
    JSON.stringify({ status: "draft", imageAssetId: asset }),
  ]);
  expect(
    (
      await asUser(a, "select * from public.portal_content where section=$1", [
        section,
      ])
    ).rows,
  ).toHaveLength(0);
  expect(
    (await asUser(admin, "select * from public.editorial_media")).rows,
  ).toHaveLength(1);
  await db.query(
    "update public.portal_content set fields=jsonb_set(fields,'{status}','\"published\"') where section=$1",
    [section],
  );
  expect(
    (await asUser(a, "select * from public.editorial_media")).rows,
  ).toHaveLength(1);
  await expect(
    asUser(
      admin,
      "update public.editorial_media set archived=true where id=$1",
      [asset],
    ),
  ).rejects.toThrow("Remove this image");
  await expect(
    asUser(
      a,
      "update public.editorial_media set alt='Unauthorized' where id=$1 returning id",
      [asset],
    ),
  ).resolves.toMatchObject({ rows: [] });
  await db.query("delete from public.portal_content where section=$1", [
    section,
  ]);
  await asUser(
    admin,
    "update public.editorial_media set archived=true where id=$1",
    [asset],
  );
  await expect(
    db.query("insert into public.portal_content values($1,$2::jsonb)", [
      section,
      JSON.stringify({ status: "published", imageAssetId: asset }),
    ]),
  ).rejects.toThrow("archived image");
  await db.query("delete from public.editorial_media where id=$1", [asset]);
});
it("only one leased email worker may claim and a stale token cannot release it", async () => {
  const first = a,
    second = b;
  expect(
    (await db.query("select public.start_mail_worker($1) ok", [first])).rows,
  ).toEqual([{ ok: true }]);
  expect(
    (await db.query("select public.start_mail_worker($1) ok", [second])).rows,
  ).toEqual([{ ok: false }]);
  await db.query("select public.stop_mail_worker($1)", [second]);
  expect(
    (await db.query("select public.start_mail_worker($1) ok", [second])).rows,
  ).toEqual([{ ok: false }]);
  await expect(
    asUser(a, "select public.start_mail_worker($1)", [second]),
  ).rejects.toThrow();
  await db.query("select public.stop_mail_worker($1)", [first]);
});
it("email claims respect the rolling allowance, retries and uncertain-delivery window", async () => {
  await db.exec(
    "delete from public.email_outbox; delete from private.mail_attempts",
  );
  await db.query("select public.start_mail_worker($1)", [a]);
  await db.exec(
    "insert into public.email_outbox(kind,dedupe_key) select 'event-invitation','quota-'||g from generate_series(1,81) g",
  );
  for (let i = 0; i < 80; i++)
    expect(
      (await db.query("select id from public.claim_portal_email($1)", [a]))
        .rows,
    ).toHaveLength(1);
  expect(
    (await db.query("select id from public.claim_portal_email($1)", [a])).rows,
  ).toHaveLength(0);
  await db.exec(
    "delete from private.mail_attempts; update public.email_outbox set skipped_at=now()",
  );
  await db.exec(
    "insert into public.email_outbox(kind,dedupe_key,first_attempt_at,delivery_unknown) values('event-reminder','unknown',now()-interval '24 hours',true)",
  );
  expect(
    (await db.query("select id from public.claim_portal_email($1)", [a])).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "select needs_review from public.email_outbox where dedupe_key='unknown'",
      )
    ).rows,
  ).toEqual([{ needs_review: true }]);
  await db.query("select public.stop_mail_worker($1)", [a]);
  await db.exec(
    "delete from public.email_outbox; delete from private.mail_attempts",
  );
});
it("reviewed retries are admin-only, auditable and get a fresh provider key", async () => {
  const old = "90000000-0000-4000-8000-000000000001";
  await db.query(
    "insert into public.email_outbox(id,kind,dedupe_key,needs_review) values($1,'event-invitation','review-test',true)",
    [old],
  );
  await expect(
    asUser(
      a,
      "select public.review_portal_email($1,'retry','Provider confirms not sent')",
      [old],
    ),
  ).rejects.toThrow("Administrator");
  await asUser(
    admin,
    "select public.review_portal_email($1,'retry','Provider confirms not sent')",
    [old],
  );
  const rows = (
    await db.query(
      "select id,attempts from public.email_outbox where dedupe_key=$1",
      ["review:" + old],
    )
  ).rows as { id: string; attempts: number }[];
  expect(rows).toHaveLength(1);
  expect(rows[0].id).not.toBe(old);
  expect(rows[0].attempts).toBe(0);
  expect(
    (
      await db.query(
        "select details from public.audit_events where action='email-review-retry'",
      )
    ).rows,
  ).toEqual([{ details: { reason: "Provider confirms not sent" } }]);
  await db.exec("delete from public.email_outbox");
});
it("revoked Auth sessions cannot keep using a valid-looking JWT", async () => {
  await db.query("delete from auth.sessions where id=$1", [b]);
  expect((await asUser(b, "select public.is_active() active")).rows).toEqual([
    { active: false },
  ]);
  expect(
    (await asUser(b, "select * from public.member_profiles")).rows,
  ).toHaveLength(0);
  await db.query("insert into auth.sessions(id,user_id) values($1,$1)", [b]);
});
it("consent records are owner-only and cannot be changed directly", async () => {
  await db.query("insert into public.member_consents values($1,'v1',now())", [
    a,
  ]);
  expect(
    (await asUser(b, "select * from public.member_consents")).rows,
  ).toHaveLength(0);
  expect(
    (await asUser(a, "select * from public.member_consents")).rows,
  ).toHaveLength(1);
  await expect(
    asUser(a, "update public.member_consents set policy_version='forged'"),
  ).rejects.toThrow();
});
it("member management RPC never returns private email data to ordinary members", async () => {
  expect(
    (await asUser(a, "select * from public.admin_members()")).rows,
  ).toHaveLength(0);
  expect(
    (
      await asUser(
        admin,
        "select * from public.admin_members('a@example.test')",
      )
    ).rows,
  ).toHaveLength(1);
});
it("denies anonymous member records", async () => {
  await expect(
    asUser(null, "select * from public.member_profiles"),
  ).rejects.toThrow();
});
it("directory returns other visible members without private membership rows", async () => {
  expect(
    (await asUser(a, "select * from public.directory_search()")).rows,
  ).toHaveLength(3);
  expect(
    (await asUser(a, "select * from public.memberships")).rows,
  ).toHaveLength(1);
});
it("cannot promote self or edit another profile", async () => {
  await expect(
    asUser(a, "update public.memberships set role='admin' where user_id=$1", [
      a,
    ]),
  ).rejects.toThrow();
  await expect(
    asUser(
      a,
      "update public.member_profiles set display_name='forged' where user_id=$1",
      [b],
    ),
  ).rejects.toThrow();
});
it("membership suspension immediately prevents directory access", async () => {
  await db.query(
    "update public.memberships set status='suspended' where user_id=$1",
    [b],
  );
  expect(
    (await asUser(b, "select * from public.directory_search()")).rows,
  ).toHaveLength(0);
  expect(
    (await asUser(a, "select * from public.directory_search()")).rows,
  ).toHaveLength(2);
  await db.query(
    "update public.memberships set status='active' where user_id=$1",
    [b],
  );
});
it("education group filtering finds a member by institution affiliation", async () => {
  const cornell = "40000000-0000-4000-8000-000000000024",
    ivy = "40000000-0000-4000-8000-000000000016";
  await db.query("insert into public.member_taxonomy_terms values($1,$2)", [
    a,
    cornell,
  ]);
  const result = await asUser(
    b,
    "select user_id from public.directory_search($1,$2::uuid[])",
    ["", `{${ivy}}`],
  );
  expect(result.rows).toEqual([{ user_id: a }]);
});
it("expired invitations cannot activate an account", async () => {
  const invited = "10000000-0000-4000-8000-000000000004";
  await db.query(
    "insert into public.member_invitations(email) values('invited@example.test')",
  );
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'invited@example.test',now())",
    [invited],
  );
  await db.query("insert into auth.sessions(id,user_id) values($1,$1)", [
    invited,
  ]);
  await db.query(
    "update public.member_invitations set expires_at=now()-interval '1 day' where email='invited@example.test'",
  );
  await expect(
    asUser(
      invited,
      "select public.finish_onboarding($1::jsonb,'{}'::uuid[],'v1')",
      [JSON.stringify({ display_name: "Invited Person" })],
    ),
  ).rejects.toThrow("expired");
  expect(
    (
      await db.query("select status from public.memberships where user_id=$1", [
        invited,
      ])
    ).rows,
  ).toEqual([{ status: "invited" }]);
});
it("members cannot create invitations or mutate private event details", async () => {
  await expect(
    asUser(
      a,
      "insert into public.member_invitations(email) values('bad@example.test')",
    ),
  ).rejects.toThrow();
  await expect(
    asUser(
      a,
      "insert into public.event_details(event_id,instructions) values(gen_random_uuid(),'bad')",
    ),
  ).rejects.toThrow();
});
it("isolates bookmarks and prevents forged ownership", async () => {
  const resource = "20000000-0000-4000-8000-000000000001";
  await db.query(
    "insert into public.resources(id,slug,title,type,status) values($1,'resource','A resource','Essay','published')",
    [resource],
  );
  await asUser(
    a,
    "insert into public.saved_resources(member_id,resource_id) values($1,$2)",
    [a, resource],
  );
  expect(
    (await asUser(b, "select * from public.saved_resources")).rows,
  ).toHaveLength(0);
  await expect(
    asUser(
      b,
      "insert into public.saved_resources(member_id,resource_id) values($1,$2)",
      [a, resource],
    ),
  ).rejects.toThrow();
});
it("private Library bodies are unavailable anonymously", async () => {
  expect(
    (await asUser(null, "select * from public.resources")).rows,
  ).toHaveLength(0);
});
it("restricts dinner details to invitees and allocates waitlist seats atomically", async () => {
  const event = "30000000-0000-4000-8000-000000000001";
  await db.query(
    "insert into public.events(id,type,title,starts_at,ends_at,capacity,status) values($1,'dinner','Dinner',now()+interval '1 day',now()+interval '2 days',1,'published')",
    [event],
  );
  await db.query(
    "insert into public.event_details(event_id,instructions) values($1,'Private address')",
    [event],
  );
  await db.query(
    "insert into public.event_invitations(event_id,member_id) values($1,$2)",
    [event, a],
  );
  expect(
    (await asUser(b, "select * from public.event_details")).rows,
  ).toHaveLength(0);
  await expect(
    asUser(b, "select public.rsvp($1,'yes')", [event]),
  ).rejects.toThrow();
  expect(
    (await asUser(a, "select public.rsvp($1,'yes') response", [event])).rows[0],
  ).toEqual({ response: "yes" });
  await db.query(
    "insert into public.event_invitations(event_id,member_id) values($1,$2)",
    [event, b],
  );
  expect(
    (await asUser(b, "select public.rsvp($1,'yes') response", [event])).rows[0],
  ).toEqual({ response: "waitlist" });
  await asUser(a, "select public.rsvp($1,'no')", [event]);
  expect(
    (
      await asUser(
        b,
        "select response from public.event_rsvps where event_id=$1",
        [event],
      )
    ).rows[0],
  ).toEqual({ response: "yes" });
});
it("members cannot moderate threads or publish content", async () => {
  await expect(
    asUser(a, "select public.publish_content('{}','x')"),
  ).rejects.toThrow();
  await expect(
    asUser(
      a,
      "insert into public.discussion_threads(author_id,title,body,pinned) values($1,'Title','Body',true)",
      [a],
    ),
  ).rejects.toThrow();
});
it("failed publication does not change the prior revision or catalog", async () => {
  const before = await db.query("select count(*) from public.resources");
  await expect(
    db.query("select public.publish_content($1::jsonb,'bad')", [
      JSON.stringify({
        terms: [],
        resources: [{ id: "invalid" }],
        events: [],
        content: [],
      }),
    ]),
  ).rejects.toThrow();
  expect(
    (await db.query("select count(*) from public.resources")).rows,
  ).toEqual(before.rows);
  expect(
    (await db.query("select * from public.cms_revisions")).rows,
  ).toHaveLength(0);
});
it("publishes, archives and restores content without losing bookmarks", async () => {
  const snapshot = {
    terms: (await db.query("select * from public.taxonomy_terms")).rows,
    resources: (await db.query("select * from public.resources")).rows,
    events: (await db.query("select * from public.events")).rows,
    content: [],
  };
  await db.query("select public.publish_content($1::jsonb,'first')", [
    JSON.stringify(snapshot),
  ]);
  await db.query("select public.publish_content($1::jsonb,'archived')", [
    JSON.stringify({ ...snapshot, resources: [] }),
  ]);
  expect((await asUser(a, "select * from public.resources")).rows).toHaveLength(
    0,
  );
  expect(
    (await asUser(a, "select * from public.saved_resources")).rows,
  ).toHaveLength(1);
  await db.query("select public.publish_content($1::jsonb,'restored')", [
    JSON.stringify(snapshot),
  ]);
  expect((await asUser(a, "select * from public.resources")).rows).toHaveLength(
    1,
  );
  expect(
    (await db.query("select * from public.cms_revisions")).rows,
  ).toHaveLength(3);
});
it("searches resource topics as well as prose", async () => {
  await db.query("update public.resources set topics=array['Negotiation']");
  expect(
    (
      await asUser(
        a,
        "select id from public.resources where search_document @@ websearch_to_tsquery('english','negotiation')",
      )
    ).rows,
  ).toHaveLength(1);
});
it("requires guidelines before posting and enforces contribution ownership", async () => {
  await expect(
    asUser(
      a,
      "insert into public.discussion_threads(author_id,title,body) values($1,$2,$3)",
      [a, "A question", "A perspective"],
    ),
  ).rejects.toThrow("guidelines");
  await db.query(
    "insert into public.portal_content values('Portal Settings:community',$1::jsonb)",
    [JSON.stringify({ "Guidelines URL": "https://example.test/guidelines" })],
  );
  const created = await asUser(
    a,
    "insert into public.discussion_threads(author_id,title,body) values($1,$2,$3) returning id",
    [a, "A question", "A perspective"],
  );
  const id = (created.rows[0] as { id: string }).id;
  await expect(
    asUser(b, "select public.edit_discussion('thread',$1,'forged','forged')", [
      id,
    ]),
  ).rejects.toThrow("own");
  await asUser(
    a,
    "select public.edit_discussion('thread',$1,'Edited perspective','Edited question')",
    [id],
  );
  expect(
    (
      await asUser(
        b,
        "select body from public.discussion_threads where id=$1",
        [id],
      )
    ).rows,
  ).toEqual([{ body: "Edited perspective" }]);
  await asUser(a, "select public.edit_discussion('thread',$1,'','',true)", [
    id,
  ]);
  expect(
    (
      await asUser(b, "select * from public.discussion_threads where id=$1", [
        id,
      ])
    ).rows,
  ).toHaveLength(0);
});
it("shapes conversation authors, keeps saves private, and validates reply trees", async () => {
  const first = (
    await asUser(
      a,
      "insert into public.discussion_threads(author_id,title,body) values($1,'A consequential choice','How should we frame it?') returning id",
      [a],
    )
  ).rows[0] as { id: string };
  const second = (
    await asUser(
      b,
      "insert into public.discussion_threads(author_id,title,body) values($1,'A second choice','Another room') returning id",
      [b],
    )
  ).rows[0] as { id: string };
  const root = (
    await asUser(
      b,
      "insert into public.discussion_comments(thread_id,author_id,body) values($1,$2,'A first response') returning id",
      [first.id, b],
    )
  ).rows[0] as { id: string };
  await asUser(
    a,
    "insert into public.discussion_comments(thread_id,author_id,body,parent_id) values($1,$2,'A nested response',$3)",
    [first.id, a, root.id],
  );
  await expect(
    asUser(
      a,
      "insert into public.discussion_comments(thread_id,author_id,body,parent_id) values($1,$2,'Wrong conversation',$3)",
      [second.id, a, root.id],
    ),
  ).rejects.toThrow("visible response");
  await asUser(
    a,
    "insert into public.discussion_saves(member_id,thread_id) values($1,$2)",
    [a, first.id],
  );
  await asUser(
    b,
    "insert into public.discussion_appreciations(member_id,thread_id) values($1,$2)",
    [b, first.id],
  );
  expect(
    (await asUser(b, "select * from public.discussion_saves")).rows,
  ).toHaveLength(0);
  const feed = await asUser(
    a,
    "select author_name,reply_count,appreciation_count,saved,appreciated from public.discussion_detail($1)",
    [first.id],
  );
  expect(feed.rows).toEqual([
    {
      author_name: "a@example.test",
      reply_count: 2,
      appreciation_count: 1,
      saved: true,
      appreciated: false,
    },
  ]);
});
it("introduction requests are visible only to requester and admin", async () => {
  await asUser(
    a,
    "insert into public.introduction_requests(requester_id,target_id,context) values($1,$2,$3)",
    [a, b, "I would value a thoughtful introduction."],
  );
  expect(
    (await asUser(b, "select * from public.introduction_requests")).rows,
  ).toHaveLength(0);
  expect(
    (await asUser(admin, "select * from public.introduction_requests")).rows,
  ).toHaveLength(1);
});
it("accepts a verified invitation once and does not allow invitation replay", async () => {
  const id = "10000000-0000-4000-8000-000000000005";
  await db.query(
    "insert into public.member_invitations(email) values('new@example.test')",
  );
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'new@example.test',now())",
    [id],
  );
  await db.query("insert into auth.sessions(id,user_id) values($1,$1)", [id]);
  expect(
    (await asUser(id, "select * from public.resources")).rows,
  ).toHaveLength(0);
  await asUser(id, "select public.finish_onboarding($1::jsonb,'{}','v1')", [
    JSON.stringify({ display_name: "New Member" }),
  ]);
  expect((await asUser(id, "select public.is_active() active")).rows).toEqual([
    { active: true },
  ]);
  await expect(
    asUser(id, "select public.finish_onboarding($1::jsonb,'{}','v1')", [
      JSON.stringify({ display_name: "New Member" }),
    ]),
  ).rejects.toThrow();
  expect(
    (
      await asUser(b, "select * from public.member_profiles where user_id=$1", [
        id,
      ])
    ).rows,
  ).toHaveLength(0);
});
it("rollback is authorized, transactional and records a reason", async () => {
  const prior = (
    await db.query<{ id: string }>(
      "select id from public.cms_revisions order by created_at limit 1",
    )
  ).rows[0];
  await expect(
    asUser(a, "select public.restore_revision($1,$2,'forged')", [prior.id, a]),
  ).rejects.toThrow();
  const restored = await db.query<{ revision: string }>(
    "select public.restore_revision($1,$2,'Restore approved copy') revision",
    [prior.id, admin],
  );
  expect(
    (
      await db.query("select body from public.admin_notes where target_id=$1", [
        restored.rows[0].revision,
      ])
    ).rows,
  ).toEqual([{ body: "Restore approved copy" }]);
});
it("a private dinner cannot accidentally be changed to a member-wide board", async () => {
  await expect(
    db.query("update public.events set type='board' where type='dinner'"),
  ).rejects.toThrow("new Event ID");
});
