import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

if (process.env.ALLOW_HOSTED_DEMO_SEED !== "1") {
  throw new Error("Set ALLOW_HOSTED_DEMO_SEED=1 to confirm this is staging.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase staging credentials are required.");

const db = createClient(url, key, { auth: { persistSession: false } });
const profiles = [
  [
    "amara.bell@demo.example",
    "Amara Bell (Demo)",
    "Chief People Officer",
    "Common Thread Labs",
    "Atlanta",
    "Georgia",
    "I help growing organizations build cultures that can hold both candor and care. Ask me about executive transitions and team trust.",
  ],
  [
    "simone.clarke@demo.example",
    "Simone Clarke (Demo)",
    "Managing Partner",
    "Clarke Advisory",
    "Washington",
    "District of Columbia",
    "An operator turned advisor who enjoys making complicated choices legible, especially when the answer is not more process.",
  ],
  [
    "imani.foster@demo.example",
    "Imani Foster (Demo)",
    "VP, Product",
    "Daybreak Health",
    "Chicago",
    "Illinois",
    "I lead digital health products and think often about responsible AI, access, and what it takes to earn customer trust.",
  ],
  [
    "lena.hart@demo.example",
    "Lena Hart (Demo)",
    "Executive Director",
    "Forward Arts",
    "Brooklyn",
    "New York",
    "Nonprofit leader, fundraiser, and generous skeptic. I am interested in sustainable growth without losing the reason the work began.",
  ],
  [
    "nia.james@demo.example",
    "Nia James (Demo)",
    "Founder & CEO",
    "Second Bloom",
    "Los Angeles",
    "California",
    "Consumer founder navigating scale, a changing board, and the daily practice of making fewer but better decisions.",
  ],
  [
    "zora.mitchell@demo.example",
    "Zora Mitchell (Demo)",
    "SVP, Communications",
    "Harbor Group",
    "Philadelphia",
    "Pennsylvania",
    "I work where reputation, leadership, and change meet. I am usually asking what needs to be said, by whom, and when.",
  ],
];

const ids = {
  resources: [
    "21000000-0000-4000-8000-000000000001",
    "21000000-0000-4000-8000-000000000002",
    "21000000-0000-4000-8000-000000000003",
    "21000000-0000-4000-8000-000000000004",
  ],
  events: [
    "31000000-0000-4000-8000-000000000001",
    "31000000-0000-4000-8000-000000000002",
    "31000000-0000-4000-8000-000000000003",
    "31000000-0000-4000-8000-000000000004",
  ],
  threads: [
    "51000000-0000-4000-8000-000000000001",
    "51000000-0000-4000-8000-000000000002",
    "51000000-0000-4000-8000-000000000003",
    "51000000-0000-4000-8000-000000000004",
  ],
  comments: [
    "52000000-0000-4000-8000-000000000001",
    "52000000-0000-4000-8000-000000000002",
    "52000000-0000-4000-8000-000000000003",
    "52000000-0000-4000-8000-000000000004",
    "52000000-0000-4000-8000-000000000005",
  ],
};

async function checked(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function findUser(email) {
  for (let page = 1; page <= 10; page += 1) {
    const data = await checked(
      db.auth.admin.listUsers({ page, perPage: 100 }),
      "List users",
    );
    const match = data.users.find((user) => user.email === email);
    if (match) return match;
    if (data.users.length < 100) break;
  }
  return null;
}

const members = [];
for (const profile of profiles) {
  let user = await findUser(profile[0]);
  if (!user) {
    user = await checked(
      db.auth.admin.createUser({
        email: profile[0],
        email_confirm: true,
        password: `${crypto.randomUUID()}Aa1!`,
        user_metadata: { staging_demo: true },
      }),
      `Create ${profile[0]}`,
    ).then((data) => data.user);
  }
  const avatarName = profile[0].split(".")[0];
  const avatarPath = `demo/${avatarName}.webp`;
  const avatar = await readFile(
    new URL(`./demo-avatars/${avatarName}.webp`, import.meta.url),
  );
  await checked(
    db.storage.from("member-avatars").upload(avatarPath, avatar, {
      contentType: "image/webp",
      upsert: true,
    }),
    `Upload portrait for ${profile[1]}`,
  );
  members.push({ id: user.id, profile, avatarPath });
}

await checked(
  db.from("memberships").upsert(
    members.map(({ id }) => ({
      user_id: id,
      status: "active",
      role: "member",
    })),
  ),
  "Memberships",
);
await checked(
  db.from("member_profiles").upsert(
    members.map(({ id, profile, avatarPath }) => ({
      user_id: id,
      display_name: profile[1],
      title: profile[2],
      company: profile[3],
      bio: profile[6],
      city: profile[4],
      region: profile[5],
      country: "United States",
      avatar_path: avatarPath,
      directory_visible: true,
      onboarding_complete: true,
    })),
  ),
  "Profiles",
);
const profileTerms = [
  [0, "40000000-0000-4000-8000-000000000007"],
  [1, "40000000-0000-4000-8000-000000000002"],
  [2, "40000000-0000-4000-8000-000000000013"],
  [2, "40000000-0000-4000-8000-000000000043"],
  [3, "40000000-0000-4000-8000-000000000011"],
  [4, "40000000-0000-4000-8000-000000000003"],
  [4, "40000000-0000-4000-8000-000000000042"],
  [5, "40000000-0000-4000-8000-000000000001"],
].map(([memberIndex, term_id]) => ({
  member_id: members[memberIndex].id,
  term_id,
}));
await checked(
  db.from("member_taxonomy_terms").upsert(profileTerms),
  "Profile taxonomy terms",
);

const resources = [
  [
    ids.resources[0],
    "questions-before-the-answer",
    "Questions before the answer",
    "A short reflection on improving a consequential decision before trying to resolve it.",
    "Begin by naming what would have to be true for each available path to become wise. Then ask which assumption deserves evidence before commitment.",
    "Essay",
    "Decision Making",
  ],
  [
    ids.resources[1],
    "responsible-ai-conversation",
    "A responsible AI conversation",
    "Prompts for moving an AI discussion beyond efficiency and toward judgment, accountability, and trust.",
    "Use these questions with a leadership team: Where must human judgment remain visible? Who can challenge the system? What would responsible failure look like?",
    "AI Prompt",
    "AI",
  ],
  [
    ids.resources[2],
    "board-decision-brief",
    "The decision-ready board brief",
    "A concise structure for giving a board enough context to offer useful counsel.",
    "State the decision, the tension, the options already considered, the constraints that cannot move, and the perspective you need from the room.",
    "Decision Brief",
    "Leadership",
  ],
  [
    ids.resources[3],
    "growth-without-hidden-debt",
    "Growth without hidden debt",
    "A fictional case about recognizing when organizational momentum begins borrowing from the future.",
    "A founder must choose between a faster milestone and a pace her team can sustain. Consider which signals distinguish healthy stretch from operational debt.",
    "Business Case",
    "Strategy",
  ],
].map(([id, slug, title, summary, body, type, topic], index) => ({
  id,
  slug,
  title: `${title} (Demo)`,
  summary,
  body,
  type,
  access: "member",
  status: "published",
  author: "The Decision Room",
  topics: [topic],
  published_at: new Date(Date.UTC(2026, 8, 1 + index)).toISOString(),
  display_order: (index + 1) * 10,
}));
await checked(db.from("resources").upsert(resources), "Resources");

const events = [
  [
    ids.events[0],
    "board",
    "The September Decision Room (Demo)",
    "A facilitated monthly board for one consequential question.",
    "2026-09-19T18:00:00-04:00",
    "2026-09-19T19:30:00-04:00",
    12,
    "Private video room",
  ],
  [
    ids.events[1],
    "board",
    "The October Decision Room (Demo)",
    "Bring a live decision and leave with a clearer next move.",
    "2026-10-17T18:00:00-04:00",
    "2026-10-17T19:30:00-04:00",
    12,
    "Private video room",
  ],
  [
    ids.events[2],
    "dinner",
    "A table for better questions (Demo)",
    "An intimate dinner shaped around thoughtful conversation rather than networking.",
    "2026-10-03T18:30:00-04:00",
    "2026-10-03T21:00:00-04:00",
    8,
    "Washington, DC",
  ],
  [
    ids.events[3],
    "dinner",
    "The autumn blind dinner (Demo)",
    "A small, confidential table for women navigating meaningful decisions.",
    "2026-11-07T18:30:00-05:00",
    "2026-11-07T21:00:00-05:00",
    10,
    "New York, NY",
  ],
].map(
  ([
    id,
    type,
    title,
    description,
    starts_at,
    ends_at,
    capacity,
    location_label,
  ]) => ({
    id,
    type,
    title,
    description,
    starts_at,
    ends_at,
    timezone: "America/New_York",
    capacity,
    status: "published",
    location_label,
    image:
      type === "board"
        ? "/images/advisory-boards-hero.webp"
        : "/images/dinners-hero.webp",
  }),
);
await checked(db.from("events").upsert(events), "Events");
const activeMemberships = await checked(
  db.from("memberships").select("user_id").eq("status", "active"),
  "Active memberships",
);
await checked(
  db
    .from("event_invitations")
    .upsert(
      activeMemberships.flatMap(({ user_id }) =>
        ids.events
          .slice(2)
          .map((event_id) => ({ event_id, member_id: user_id })),
      ),
    ),
  "Dinner invitations",
);

const author = (index) => members[index].id;
const threads = [
  [
    ids.threads[0],
    author(1),
    "What decision deserves the room this month?",
    "Bring one decision that has resisted the usual pros-and-cons list. What makes it difficult, and what would become possible if you saw it differently?",
    true,
    "2026-09-02T14:00:00Z",
  ],
  [
    ids.threads[1],
    author(4),
    "How do you know when growth is costing too much?",
    "We can hit the next milestone, but the path asks more of the team than I am comfortable normalizing. What signals distinguish healthy stretch from hidden debt?",
    false,
    "2026-09-08T16:30:00Z",
  ],
  [
    ids.threads[2],
    author(2),
    "Where should human judgment stay in an AI-assisted process?",
    "Efficiency is not the only value at stake. Where have you drawn a clear human-in-the-loop boundary, and why?",
    false,
    "2026-09-10T18:15:00Z",
  ],
  [
    ids.threads[3],
    author(0),
    "What does a candid leadership transition sound like?",
    "How have you communicated change without either overexplaining or hiding behind polished language?",
    false,
    "2026-09-11T13:20:00Z",
  ],
].map(([id, author_id, title, body, pinned, created_at]) => ({
  id,
  author_id,
  title: `${title} (Demo)`,
  body,
  status: "open",
  pinned,
  created_at,
}));
await checked(db.from("discussion_threads").upsert(threads), "Conversations");

const comments = [
  [
    ids.comments[0],
    ids.threads[1],
    author(1),
    "I watch for borrowed urgency. If the deadline belongs mostly to a narrative rather than a customer need, I treat it as a prompt to renegotiate the plan.",
    null,
    "2026-09-08T18:00:00Z",
  ],
  [
    ids.comments[1],
    ids.threads[1],
    author(0),
    "A sprint can be chosen, but a pace becomes culture when no one can name its end.",
    ids.comments[0],
    "2026-09-08T19:10:00Z",
  ],
  [
    ids.comments[2],
    ids.threads[2],
    author(3),
    "We kept human review anywhere the recommendation could materially narrow a person's options.",
    null,
    "2026-09-10T20:00:00Z",
  ],
  [
    ids.comments[3],
    ids.threads[3],
    author(5),
    "Start with what remains true: the contribution mattered, the role is changing, and people deserve clarity about what happens next.",
    null,
    "2026-09-11T15:45:00Z",
  ],
  [
    ids.comments[4],
    ids.threads[0],
    author(4),
    "I am thinking through when a strategic compromise becomes a values compromise. I want a better test than instinct alone.",
    null,
    "2026-09-03T09:30:00Z",
  ],
].map(([id, thread_id, author_id, body, parent_id, created_at]) => ({
  id,
  thread_id,
  author_id,
  body,
  parent_id,
  hidden: false,
  created_at,
}));
await checked(
  db.from("discussion_comments").upsert(comments),
  "Conversation replies",
);

console.log(
  JSON.stringify(
    {
      members: members.length,
      resources: resources.length,
      advisoryBoards: 2,
      blindDinners: 2,
      conversations: threads.length,
      replies: comments.length,
    },
    null,
    2,
  ),
);
