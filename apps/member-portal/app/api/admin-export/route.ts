import { requireMember, checked } from "@/lib/supabase";
import { uuid } from "@/lib/validation";
export async function GET(request: Request) {
  const { db } = await requireMember(true);
  const event = new URL(request.url).searchParams.get("event");
  if (!uuid.safeParse(event).success)
    return new Response(null, { status: 400 });
  const rows = checked(
    await db
      .from("event_rsvps")
      .select("member_id,response,dietary_note")
      .eq("event_id", event!),
  );
  const profiles = checked(
    await db.from("member_profiles").select("user_id,display_name"),
  );
  const cell = (value: string) =>
    `"${(/^[=+@\-\t\r\n]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
  const csv = [
    ["Member", "Response", "Dietary note"],
    ...rows.map((r) => [
      profiles.find((p) => p.user_id === r.member_id)?.display_name ||
        r.member_id,
      r.response,
      r.dietary_note,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="event-rsvps.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
