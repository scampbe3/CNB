import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serviceDatabase } from "./supabase";
export async function rateLimit(
  action: string,
  identity: string,
  maximum = 15,
  seconds = 3600,
) {
  const { data, error } = await serviceDatabase().rpc("check_rate_limit", {
    bucket: createHash("sha256").update(`${action}:${identity}`).digest("hex"),
    maximum,
    seconds,
  });
  if (error || !data)
    throw new Error("Please wait a little before trying again.");
}
export async function authRate(action: string, email: string) {
  const h = await headers();
  const ip =
    h.get("x-vercel-forwarded-for") || h.get("x-forwarded-for") || "local";
  await rateLimit(`${action}:ip`, ip.split(",")[0].trim(), 40);
  await rateLimit(`${action}:email`, email.toLowerCase(), 10);
}
