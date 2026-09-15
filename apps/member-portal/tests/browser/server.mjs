// Test-only HTTP fixture. Auth and REST responses are simulated; SQL/RLS is tested separately.
// This process is never imported by the application and only listens on loopback.
import { createServer } from "node:http";
const member = "10000000-0000-4000-8000-000000000001";
const peer = "10000000-0000-4000-8000-000000000002";
const admin = "10000000-0000-4000-8000-000000000003";
const resource = "20000000-0000-4000-8000-000000000001";
const profileSeeds = [
  [
    member,
    "member@example.test",
    "Test Member",
    "Strategy Director",
    "Northstar Studio",
    "London",
    "A synthetic test profile used to explore the portal as an ordinary member.",
  ],
  [
    peer,
    "peer@example.test",
    "Test Founder",
    "Founder",
    "A Thoughtful Company",
    "New York",
    "Building a company where ambitious work and humane leadership can coexist.",
  ],
  [
    admin,
    "admin@example.test",
    "Test Administrator",
    "Community Director",
    "Cupcakes + Broccoli",
    "London",
    "A synthetic administrator profile for operating and moderating the local demo.",
  ],
  [
    "10000000-0000-4000-8000-000000000004",
    "amara@example.test",
    "Amara Bell",
    "Chief People Officer",
    "Common Thread Labs",
    "Atlanta",
    "I help growing organizations build cultures that can hold both candor and care. Ask me about executive transitions and team trust.",
  ],
  [
    "10000000-0000-4000-8000-000000000005",
    "simone@example.test",
    "Simone Clarke",
    "Managing Partner",
    "Clarke Advisory",
    "Washington",
    "An operator turned advisor who enjoys making complicated choices legible, especially when the answer is not more process.",
  ],
  [
    "10000000-0000-4000-8000-000000000006",
    "imani@example.test",
    "Imani Foster",
    "VP, Product",
    "Daybreak Health",
    "Chicago",
    "I lead digital health products and think often about responsible AI, access, and what it takes to earn customer trust.",
  ],
  [
    "10000000-0000-4000-8000-000000000007",
    "lena@example.test",
    "Lena Hart",
    "Executive Director",
    "Forward Arts",
    "Brooklyn",
    "Nonprofit leader, fundraiser, and generous skeptic. I am interested in sustainable growth without losing the reason the work began.",
  ],
  [
    "10000000-0000-4000-8000-000000000008",
    "nia@example.test",
    "Nia James",
    "Founder & CEO",
    "Second Bloom",
    "Los Angeles",
    "Consumer founder navigating scale, a changing board, and the daily practice of making fewer but better decisions.",
  ],
  [
    "10000000-0000-4000-8000-000000000009",
    "zora@example.test",
    "Zora Mitchell",
    "SVP, Communications",
    "Harbor Group",
    "Philadelphia",
    "I work where reputation, leadership, and change meet. I am usually asking what needs to be said, by whom, and when.",
  ],
];
const users = profileSeeds.map(([id, email]) => ({
  id,
  aud: "authenticated",
  role: "authenticated",
  email,
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
}));
const tables = {
  memberships: users.map((u) => ({
    user_id: u.id,
    status: "active",
    role: u.id === admin ? "admin" : "member",
    created_at: new Date().toISOString(),
  })),
  member_profiles: profileSeeds.map(
    ([id, , name, title, company, city, bio]) => ({
      user_id: id,
      display_name: name,
      title,
      company,
      bio,
      city,
      region: "",
      country: "",
      avatar_path: null,
      directory_visible: true,
      onboarding_complete: true,
    }),
  ),
  resources: [
    {
      id: resource,
      slug: "better-questions",
      title: "Better questions, better decisions",
      summary: "A synthetic essay for browser verification.",
      body: "Private fixture content for approved members.",
      type: "Essay",
      access: "member",
      status: "published",
      author: "Test author",
      topics: ["Strategy"],
      display_order: 10,
    },
    {
      id: "20000000-0000-4000-8000-000000000002",
      slug: "public-perspective",
      title: "A public perspective",
      summary: "A public test resource.",
      body: "Public sample body.",
      type: "Decision Brief",
      access: "public",
      status: "published",
      author: "Test author",
      topics: [],
      display_order: 20,
    },
  ],
  taxonomy_terms: [
    {
      id: "40000000-0000-4000-8000-000000000001",
      kind: "profession",
      label: "Entrepreneur / Founder",
      active: true,
      display_order: 10,
    },
    {
      id: "40000000-0000-4000-8000-000000000041",
      kind: "expertise",
      label: "Marketing Strategy",
      active: true,
      display_order: 20,
    },
    {
      id: "40000000-0000-4000-8000-000000000042",
      kind: "expertise",
      label: "Entrepreneurship",
      active: true,
      display_order: 30,
    },
    {
      id: "40000000-0000-4000-8000-000000000043",
      kind: "expertise",
      label: "AI",
      active: true,
      display_order: 40,
    },
  ],
  member_taxonomy_terms: [
    [peer, "40000000-0000-4000-8000-000000000042"],
    [
      "10000000-0000-4000-8000-000000000004",
      "40000000-0000-4000-8000-000000000001",
    ],
    [
      "10000000-0000-4000-8000-000000000005",
      "40000000-0000-4000-8000-000000000041",
    ],
    [
      "10000000-0000-4000-8000-000000000006",
      "40000000-0000-4000-8000-000000000043",
    ],
    [
      "10000000-0000-4000-8000-000000000008",
      "40000000-0000-4000-8000-000000000042",
    ],
    [
      "10000000-0000-4000-8000-000000000009",
      "40000000-0000-4000-8000-000000000041",
    ],
  ].map(([member_id, term_id]) => ({ member_id, term_id })),
  saved_resources: [],
  portal_content: [
    {
      section: "Portal Settings:community",
      fields: { "Guidelines URL": "https://example.test/guidelines" },
    },
  ],
  events: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      type: "board",
      title: "A thoughtful monthly board",
      description: "Synthetic test gathering.",
      starts_at: new Date(Date.now() + 86400000 * 5).toISOString(),
      ends_at: new Date(Date.now() + 86400000 * 5 + 3600000).toISOString(),
      timezone: "Europe/London",
      capacity: 10,
      status: "published",
      location_label: "Online",
    },
  ],
  event_details: [],
  event_rsvps: [],
  event_invitations: [],
  discussion_threads: [
    {
      id: "50000000-0000-4000-8000-000000000001",
      author_id: admin,
      title: "What decision deserves the room this month?",
      body: "Bring one decision that has resisted the usual pros-and-cons list. What makes it difficult, and what would become possible if you saw it differently?",
      status: "open",
      pinned: true,
      created_at: "2026-09-02T14:00:00.000Z",
    },
    {
      id: "50000000-0000-4000-8000-000000000002",
      author_id: "10000000-0000-4000-8000-000000000008",
      title: "How do you know when growth is costing too much?",
      body: "We can hit the next milestone, but the path there asks more of the team than I am comfortable normalizing. I am weighing a slower plan against the fear that the window will close. What signals have helped you distinguish healthy stretch from hidden debt?",
      status: "open",
      pinned: false,
      created_at: "2026-09-08T16:30:00.000Z",
    },
    {
      id: "50000000-0000-4000-8000-000000000003",
      author_id: "10000000-0000-4000-8000-000000000006",
      title: "Where should human judgment stay in an AI-assisted process?",
      body: "Our team is designing an internal assistant for decisions that used to rely on experienced reviewers. Efficiency is not the only value at stake. I would value examples of where you drew a clear human-in-the-loop boundary and why.",
      status: "open",
      pinned: false,
      created_at: "2026-09-10T18:15:00.000Z",
    },
    {
      id: "50000000-0000-4000-8000-000000000004",
      author_id: "10000000-0000-4000-8000-000000000004",
      title: "What does a candid leadership transition sound like?",
      body: "A respected leader is moving out of an operating role. The organization needs clarity, but I do not want the announcement to flatten a complicated and meaningful chapter. How have you communicated change without either overexplaining or hiding behind polished language?",
      status: "open",
      pinned: false,
      created_at: "2026-09-11T13:20:00.000Z",
    },
    {
      id: "50000000-0000-4000-8000-000000000005",
      author_id: "10000000-0000-4000-8000-000000000007",
      title: "A useful way to say no to a good opportunity",
      body: "We were offered a partnership that is credible, funded, and slightly outside our purpose. I am looking for language that protects the relationship while making the boundary unmistakable. What has worked for you?",
      status: "locked",
      pinned: false,
      created_at: "2026-08-28T11:00:00.000Z",
    },
  ],
  discussion_comments: [
    {
      id: "51000000-0000-4000-8000-000000000001",
      thread_id: "50000000-0000-4000-8000-000000000002",
      author_id: "10000000-0000-4000-8000-000000000005",
      body: "I watch for borrowed urgency. If the deadline belongs mostly to an investor narrative rather than a customer need, I treat it as a prompt to renegotiate the plan.",
      parent_id: null,
      hidden: false,
      created_at: "2026-09-08T18:00:00.000Z",
      edited_at: null,
    },
    {
      id: "51000000-0000-4000-8000-000000000002",
      thread_id: "50000000-0000-4000-8000-000000000002",
      author_id: "10000000-0000-4000-8000-000000000004",
      body: "Borrowed urgency is exactly the phrase. I would add repeatability: a sprint can be chosen, but a pace becomes culture when no one can name its end.",
      parent_id: "51000000-0000-4000-8000-000000000001",
      hidden: false,
      created_at: "2026-09-08T19:10:00.000Z",
      edited_at: null,
    },
    {
      id: "51000000-0000-4000-8000-000000000003",
      thread_id: "50000000-0000-4000-8000-000000000003",
      author_id: peer,
      body: "We kept human review anywhere the recommendation could materially narrow a person's options. That principle was easier to defend than a list of technologies.",
      parent_id: null,
      hidden: false,
      created_at: "2026-09-10T20:00:00.000Z",
      edited_at: null,
    },
    {
      id: "51000000-0000-4000-8000-000000000004",
      thread_id: "50000000-0000-4000-8000-000000000004",
      author_id: "10000000-0000-4000-8000-000000000009",
      body: "Start with what remains true: the contribution mattered, the role is changing, and the organization owes people a clear account of what happens next.",
      parent_id: null,
      hidden: false,
      created_at: "2026-09-11T15:45:00.000Z",
      edited_at: null,
    },
    {
      id: "51000000-0000-4000-8000-000000000005",
      thread_id: "50000000-0000-4000-8000-000000000001",
      author_id: member,
      body: "I am thinking through when a strategic compromise becomes a values compromise. The answer feels situational, but I want a better test than instinct alone.",
      parent_id: null,
      hidden: false,
      created_at: "2026-09-03T09:30:00.000Z",
      edited_at: null,
    },
  ],
  discussion_saves: [
    {
      member_id: member,
      thread_id: "50000000-0000-4000-8000-000000000003",
      created_at: "2026-09-12T10:00:00.000Z",
    },
  ],
  discussion_appreciations: [
    [member, "50000000-0000-4000-8000-000000000002"],
    [peer, "50000000-0000-4000-8000-000000000002"],
    [
      "10000000-0000-4000-8000-000000000004",
      "50000000-0000-4000-8000-000000000003",
    ],
    [
      "10000000-0000-4000-8000-000000000009",
      "50000000-0000-4000-8000-000000000004",
    ],
  ].map(([member_id, thread_id]) => ({
    member_id,
    thread_id,
    created_at: "2026-09-12T10:00:00.000Z",
  })),
  discussion_reports: [],
  member_warnings: [],
  introduction_requests: [],
  member_invitations: [],
  file_assets: [],
  cms_revisions: [],
  audit_events: [],
  email_outbox: [],
  admin_notes: [],
  member_consents: [],
};
const jwt = (user) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        session_id: user.id,
        email: user.email,
        role: "authenticated",
        aud: "authenticated",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      }),
    ).toString("base64url"),
    "fixture-signature",
  ].join(".");
function actor(req) {
  try {
    const token = req.headers.authorization?.slice(7);
    return users.find(
      (u) =>
        u.id ===
        JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
          .sub,
    );
  } catch {
    return null;
  }
}
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4181");
  const user = actor(req);
  let body = "";
  for await (const chunk of req) body += chunk;
  const input = body ? JSON.parse(body) : {};
  const send = (data, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(status === 204 ? "" : JSON.stringify(data));
  };
  if (url.pathname === "/health") return send({ fixture: true });
  if (url.pathname === "/auth/v1/token") {
    const found = users.find((u) => u.email === input.email);
    if (!found || input.password !== "fixture-password-123")
      return send({ msg: "Invalid credentials" }, 400);
    return send({
      access_token: jwt(found),
      refresh_token: "fixture-refresh",
      expires_in: 86400,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      token_type: "bearer",
      user: found,
    });
  }
  if (url.pathname === "/auth/v1/user")
    return user ? send(user) : send({ msg: "No fixture session" }, 401);
  if (url.pathname === "/auth/v1/logout") return send(null, 204);
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const fn = url.pathname.split("/").pop();
    if (fn === "check_rate_limit") return send(true);
    if (fn === "is_active" || fn === "has_session") return send(Boolean(user));
    if (fn === "admin_members")
      return send(
        user?.id === admin
          ? tables.memberships.map((m) => ({
              ...m,
              ...tables.member_profiles.find((p) => p.user_id === m.user_id),
              email: users.find((u) => u.id === m.user_id).email,
              total: users.length,
            }))
          : [],
      );
    if (fn === "directory_search")
      return send(
        user
          ? (() => {
              const matches = tables.member_profiles.filter(
                (p) =>
                  (!input.query ||
                    [p.display_name, p.title, p.company, p.bio]
                      .join(" ")
                      .toLowerCase()
                      .includes(input.query.toLowerCase())) &&
                  (!input.location_query ||
                    p.city
                      .toLowerCase()
                      .includes(input.location_query.toLowerCase())),
              );
              return matches.map((p) => ({
                ...p,
                tags: tables.member_taxonomy_terms
                  .filter((item) => item.member_id === p.user_id)
                  .map((item) =>
                    tables.taxonomy_terms.find(
                      (term) => term.id === item.term_id,
                    ),
                  )
                  .filter(Boolean),
                total: matches.length,
              }));
            })()
          : [],
      );
    if (fn === "discussion_feed") {
      if (!user) return send([]);
      const saved = new Set(
        tables.discussion_saves
          .filter((item) => item.member_id === user.id)
          .map((item) => item.thread_id),
      );
      let matches = tables.discussion_threads
        .filter((thread) => thread.status !== "hidden")
        .filter(
          (thread) =>
            !input.target_author || thread.author_id === input.target_author,
        )
        .filter((thread) => !input.saved_only || saved.has(thread.id))
        .filter((thread) => {
          const author = tables.member_profiles.find(
            (profile) => profile.user_id === thread.author_id,
          );
          return (
            !input.search_query ||
            [thread.title, thread.body, author?.display_name]
              .join(" ")
              .toLowerCase()
              .includes(input.search_query.toLowerCase())
          );
        })
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            b.created_at.localeCompare(a.created_at),
        );
      const total = matches.length;
      const offset = (Math.max(1, Number(input.page_number) || 1) - 1) * 24;
      matches = matches.slice(offset, offset + 24);
      return send(
        matches.map((thread) => {
          const author = tables.member_profiles.find(
            (profile) => profile.user_id === thread.author_id,
          );
          return {
            ...thread,
            author_name: author?.display_name || "A member",
            author_avatar_path: author?.avatar_path || null,
            reply_count: tables.discussion_comments.filter(
              (comment) => comment.thread_id === thread.id && !comment.hidden,
            ).length,
            appreciation_count: tables.discussion_appreciations.filter(
              (item) => item.thread_id === thread.id,
            ).length,
            saved: saved.has(thread.id),
            appreciated: tables.discussion_appreciations.some(
              (item) =>
                item.thread_id === thread.id && item.member_id === user.id,
            ),
            total,
          };
        }),
      );
    }
    if (fn === "discussion_detail") {
      if (!user) return send([]);
      const thread = tables.discussion_threads.find(
        (item) => item.id === input.target && item.status !== "hidden",
      );
      if (!thread) return send([]);
      const author = tables.member_profiles.find(
        (profile) => profile.user_id === thread.author_id,
      );
      return send([
        {
          ...thread,
          author_name: author?.display_name || "A member",
          author_avatar_path: author?.avatar_path || null,
          reply_count: tables.discussion_comments.filter(
            (comment) => comment.thread_id === thread.id && !comment.hidden,
          ).length,
          appreciation_count: tables.discussion_appreciations.filter(
            (item) => item.thread_id === thread.id,
          ).length,
          saved: tables.discussion_saves.some(
            (item) =>
              item.thread_id === thread.id && item.member_id === user.id,
          ),
          appreciated: tables.discussion_appreciations.some(
            (item) =>
              item.thread_id === thread.id && item.member_id === user.id,
          ),
          total: 1,
        },
      ]);
    }
    if (fn === "discussion_replies") {
      if (!user) return send([]);
      return send(
        tables.discussion_comments
          .filter(
            (comment) => comment.thread_id === input.target && !comment.hidden,
          )
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((comment) => {
            const author = tables.member_profiles.find(
              (profile) => profile.user_id === comment.author_id,
            );
            return {
              ...comment,
              author_name: author?.display_name || "A member",
              author_avatar_path: author?.avatar_path || null,
            };
          }),
      );
    }
    if (fn === "update_profile") {
      Object.assign(
        tables.member_profiles.find((p) => p.user_id === user?.id),
        input.profile,
      );
      return send(null);
    }
    if (fn === "rsvp") {
      tables.event_rsvps = tables.event_rsvps.filter(
        (r) => r.member_id !== user.id || r.event_id !== input.target,
      );
      tables.event_rsvps.push({
        event_id: input.target,
        member_id: user.id,
        response: input.answer,
        dietary_note: input.note,
      });
      return send(input.answer);
    }
    return send({ message: `Unimplemented fixture RPC: ${fn}` }, 400);
  }
  const table = url.pathname.split("/").pop();
  if (!url.pathname.startsWith("/rest/v1/") || !tables[table])
    return send({ message: "Unknown fixture endpoint" }, 404);
  let rows = tables[table];
  if (table === "resources" && !user)
    rows = rows.filter((r) => r.access === "public");
  else if (!user && req.headers.apikey !== "fixture-service-key") rows = [];
  if (
    [
      "saved_resources",
      "event_rsvps",
      "discussion_saves",
      "discussion_appreciations",
    ].includes(table)
  )
    rows = rows.filter((r) => r.member_id === user?.id);
  if (table === "memberships" && user?.id !== admin)
    rows = rows.filter((r) => r.user_id === user?.id);
  const filter = (row) =>
    [...url.searchParams].every(([key, value]) => {
      if (["select", "order", "limit", "offset", "on_conflict"].includes(key))
        return true;
      const [op, ...tail] = value.split(".");
      const v = tail.join(".");
      if (op === "eq") return String(row[key]) === v;
      if (op === "gte") return row[key] >= v;
      if (op === "is")
        return v === "null" ? row[key] == null : String(row[key]) === v;
      if (op.startsWith("wfts"))
        return [row.title, row.summary, row.body, ...(row.topics || [])]
          .join(" ")
          .toLowerCase()
          .includes(v.toLowerCase());
      return true;
    });
  rows = rows.filter(filter);
  if (req.method === "POST") {
    const row = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      saved_at: new Date().toISOString(),
      status: "open",
      ...input,
    };
    tables[table].push(row);
    rows = [row];
  }
  if (req.method === "PATCH") rows.forEach((row) => Object.assign(row, input));
  if (req.method === "DELETE") {
    tables[table] = tables[table].filter((row) => !rows.includes(row));
    rows = [];
  }
  const count = rows.length;
  if (
    table === "saved_resources" &&
    (url.searchParams.get("select") || "").includes("resources(")
  )
    rows = rows.map((r) => ({
      ...r,
      resources: tables.resources.find((x) => x.id === r.resource_id),
    }));
  if (
    table === "member_taxonomy_terms" &&
    (url.searchParams.get("select") || "").includes("taxonomy_terms(")
  )
    rows = rows.map((r) => ({
      ...r,
      taxonomy_terms: tables.taxonomy_terms.find((x) => x.id === r.term_id),
    }));
  const offset = Number(url.searchParams.get("offset") || 0);
  rows = rows.slice(
    offset,
    offset + Number(url.searchParams.get("limit") || 1000),
  );
  if (req.headers.prefer?.includes("count=exact"))
    res.setHeader("Content-Range", `0-${Math.max(0, count - 1)}/${count}`);
  if (req.method === "HEAD") {
    res.writeHead(200);
    return res.end();
  }
  if (req.headers.accept?.includes("application/vnd.pgrst.object+json"))
    return rows.length === 1
      ? send(rows[0])
      : send(
          {
            code: "PGRST116",
            details: `The result contains ${rows.length} rows`,
            message: "Expected one row",
          },
          406,
        );
  return send(rows);
}).listen(Number(process.env.CNB_FIXTURE_PORT || 4181), "127.0.0.1", () =>
  console.log(
    `Isolated browser fixture listening on loopback ${process.env.CNB_FIXTURE_PORT || 4181}. No external services are contacted.`,
  ),
);
