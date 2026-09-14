import { requireMember } from "@/lib/supabase";
import { uuid } from "@/lib/validation";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db } = await requireMember();
  const { id } = await params;
  if (!uuid.safeParse(id).success) return new Response(null, { status: 404 });
  const { data: p } = await db
    .from("member_profiles")
    .select("avatar_path")
    .eq("user_id", id)
    .maybeSingle();
  if (!p?.avatar_path) return new Response(null, { status: 404 });
  const { data, error } = await db.storage
    .from("member-avatars")
    .download(p.avatar_path);
  if (error || !data) return new Response(null, { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
