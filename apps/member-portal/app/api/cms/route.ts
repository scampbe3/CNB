import { createHmac, timingSafeEqual } from "node:crypto";
import { publishFromSheet } from "@/lib/cms/server";
import { serviceDatabase } from "@/lib/supabase";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.SHEET_PUBLISH_SECRET;
  if (!secret)
    return Response.json(
      { error: "Publishing is not configured." },
      { status: 503 },
    );
  const raw = await request.text();
  if (raw.length > 4096) return new Response(null, { status: 413 });
  const supplied = request.headers.get("x-cnb-signature") || "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (
    !/^[a-f0-9]{64}$/.test(supplied) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return new Response(null, { status: 401 });
  try {
    const payload = JSON.parse(raw);
    if (
      typeof payload.timestamp !== "number" ||
      Math.abs(Date.now() - payload.timestamp) > 300000 ||
      !/^[a-f0-9-]{36}$/.test(payload.nonce) ||
      typeof payload.preview !== "boolean" ||
      payload.workbook !== process.env.GOOGLE_SHEET_ID
    )
      return new Response(null, { status: 400 });
    const { data, error } = await serviceDatabase().rpc("claim_publish_nonce", {
      value: payload.nonce,
    });
    if (error || !data) return new Response(null, { status: 409 });
    return Response.json({ message: await publishFromSheet(payload.preview) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Publication failed." },
      { status: 422 },
    );
  }
}
