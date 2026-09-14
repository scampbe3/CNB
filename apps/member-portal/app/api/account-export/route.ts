import { requireMember, checked, serviceDatabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/limits";
export async function GET() {
  const { user } = await requireMember();
  const db = serviceDatabase();
  await rateLimit("account-export", user.id, 5);
  const output: Record<string, unknown> = {
    email: user.email,
    exportedAt: new Date().toISOString(),
  };
  for (const [table, column] of [
    ["member_profiles", "user_id"],
    ["member_consents", "member_id"],
    ["member_taxonomy_terms", "member_id"],
    ["saved_resources", "member_id"],
    ["event_rsvps", "member_id"],
    ["introduction_requests", "requester_id"],
    ["discussion_threads", "author_id"],
    ["discussion_comments", "author_id"],
  ])
    output[table] = checked(
      await db.from(table).select("*").eq(column, user.id),
    );
  return new Response(JSON.stringify(output, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition":
        'attachment; filename="my-decision-room-information.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
