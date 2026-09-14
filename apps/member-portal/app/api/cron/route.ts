import { timingSafeEqual } from "node:crypto";
import { deliverEventEmails } from "@/lib/email";
export const maxDuration = 60;
export async function GET(request: Request) {
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (
    !process.env.CRON_SECRET ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return new Response(null, { status: 401 });
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
    return Response.json(
      { error: "Email delivery is not configured." },
      { status: 503 },
    );
  return Response.json(await deliverEventEmails(true));
}
