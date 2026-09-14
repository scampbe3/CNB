import { requireMember } from "@/lib/supabase";
import { uuid, calendarEvent } from "@/lib/validation";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db } = await requireMember();
  const { id } = await params;
  if (!uuid.safeParse(id).success) return new Response(null, { status: 404 });
  const { data: event } = await db
    .from("events")
    .select("id,title,description,starts_at,ends_at,location_label")
    .eq("id", id)
    .maybeSingle();
  if (!event) return new Response(null, { status: 404 });
  return new Response(calendarEvent(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="decision-room.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
