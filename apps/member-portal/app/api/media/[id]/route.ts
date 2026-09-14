import { database, serviceDatabase, checked } from "@/lib/supabase";
import { uuid } from "@/lib/validation";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) return new Response(null, { status: 404 });
  const db = await database();
  const { data: active } = await db.rpc("is_active");
  if (!active) return new Response(null, { status: 401 });
  const media = checked(
    await db
      .from("editorial_media")
      .select("path")
      .eq("id", id.data)
      .maybeSingle(),
  );
  if (!media) return new Response(null, { status: 404 });
  const blob = checked(
    await serviceDatabase()
      .storage.from("editorial-images")
      .download(media.path),
  );
  return new Response(blob, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
