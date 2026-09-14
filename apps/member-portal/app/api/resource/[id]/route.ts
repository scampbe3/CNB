import { database, serviceDatabase } from "@/lib/supabase";
import { uuid } from "@/lib/validation";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return new Response(null, { status: 404 });
  const db = await database();
  const { data: r, error } = await db
    .from("resources")
    .select("file_asset_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !r?.file_asset_id) return new Response(null, { status: 404 });
  const service = serviceDatabase();
  const { data: file } = await service
    .from("file_assets")
    .select("path,name")
    .eq("id", r.file_asset_id)
    .single();
  if (!file) return new Response(null, { status: 404 });
  const { data: signed, error: signError } = await service.storage
    .from("member-resources")
    .createSignedUrl(file.path, 60, { download: file.name });
  if (signError || !signed)
    return new Response("Please try again.", { status: 503 });
  return Response.redirect(signed.signedUrl, 303);
}
