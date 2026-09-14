import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { safeNext } from "./validation";
import { redirect } from "next/navigation";
export function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export function portalUrl() {
  return process.env.PORTAL_URL || "http://localhost:4180";
}
export async function database() {
  if (!configured()) redirect("/setup");
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Proxy refreshes cookies during server rendering. */
          }
        },
      },
    },
  );
}
export function serviceDatabase() {
  if (!configured() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Server connection is not configured.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function identity() {
  const db = await database();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    redirect(
      `/login?next=${encodeURIComponent(safeNext((await headers()).get("x-cnb-return-path")))}`,
    );
  const { data: membership, error } = await db
    .from("memberships")
    .select("status,role")
    .eq("user_id", user.id)
    .single();
  if (error || !membership)
    redirect("/login?message=An%20invitation%20is%20required.");
  return {
    db,
    user,
    membership: membership as { status: string; role: string },
  };
}
export async function requireMember(admin = false) {
  const context = await identity();
  if (context.membership.status === "invited") redirect("/onboarding");
  const { data: active } = await context.db.rpc("is_active");
  if (!active) redirect("/account-status");
  if (admin && context.membership.role !== "admin") redirect("/");
  return context;
}
export function checked<T>(result: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (result.error) {
    console.error("Database operation failed:", result.error.message);
    throw new Error("We could not complete that request. Please try again.");
  }
  return result.data as NonNullable<T>;
}
