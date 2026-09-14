import { configured } from "@/lib/supabase";
export async function GET() {
  return Response.json(
    { status: configured() ? "configured" : "setup-required" },
    { status: configured() ? 200 : 503 },
  );
}
