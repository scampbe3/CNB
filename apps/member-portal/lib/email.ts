import "server-only";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { checked, portalUrl, serviceDatabase } from "./supabase";
type MailPayload = {
  from: string;
  to: string[];
  subject: string;
  text: string;
};
type QueueRow = {
  id: string;
  recipient_id: string;
  event_id: string;
  kind: string;
  attempts: number;
  delivery_payload: MailPayload | null;
  delivery_unknown: boolean;
};
const subjects: Record<string, string> = {
  "event-invitation": "An invitation from The Decision Room",
  "waitlist-promoted": "A place has opened for you",
  "event-reminder": "Your gathering is coming up",
  "event-updated": "Your gathering details have changed",
  "event-cancelled": "Your gathering has been cancelled",
};
export function scheduleEventEmailDelivery() {
  after(async () => {
    try {
      await deliverEventEmails();
    } catch {
      console.error(
        "Event email delivery deferred; review Administration > audit.",
      );
    }
  });
}
export async function deliverEventEmails(reminders = false) {
  const result = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    deferred: false,
  };
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
    return { ...result, deferred: true };
  const db = serviceDatabase();
  const worker = randomUUID();
  if (!checked(await db.rpc("start_mail_worker", { worker })))
    return { ...result, deferred: true };
  const deadline = Date.now() + 45000;
  try {
    if (reminders) checked(await db.rpc("prepare_reminders"));
    while (Date.now() < deadline && result.processed < 80) {
      const [row] = checked(
        await db.rpc("claim_portal_email", { worker }),
      ) as QueueRow[];
      if (!row) break;
      result.processed++;
      let uncertain = row.delivery_unknown;
      try {
        const member = checked(
          await db
            .from("memberships")
            .select("status")
            .eq("user_id", row.recipient_id)
            .maybeSingle(),
        );
        const event = checked(
          await db
            .from("events")
            .select("title,type,status,starts_at")
            .eq("id", row.event_id)
            .maybeSingle(),
        );
        const invite =
          event?.type === "dinner"
            ? checked(
                await db
                  .from("event_invitations")
                  .select("member_id")
                  .eq("event_id", row.event_id)
                  .eq("member_id", row.recipient_id)
                  .maybeSingle(),
              )
            : true;
        const rsvp = ["event-reminder", "waitlist-promoted"].includes(row.kind)
          ? checked(
              await db
                .from("event_rsvps")
                .select("response")
                .eq("event_id", row.event_id)
                .eq("member_id", row.recipient_id)
                .maybeSingle(),
            )
          : { response: "yes" };
        const obsolete =
          !event ||
          ["draft", "archived"].includes(event.status) ||
          (event.status === "cancelled") !== (row.kind === "event-cancelled") ||
          (new Date(event.starts_at).getTime() < Date.now() &&
            [
              "event-invitation",
              "event-reminder",
              "waitlist-promoted",
            ].includes(row.kind));
        if (
          member?.status !== "active" ||
          !invite ||
          rsvp?.response !== "yes" ||
          obsolete
        ) {
          checked(
            await db
              .from("email_outbox")
              .update({
                skipped_at: new Date().toISOString(),
                locked_until: null,
                last_error: "No longer eligible or relevant",
              })
              .eq("id", row.id),
          );
          result.skipped++;
          continue;
        }
        const {
          data: { user },
          error,
        } = await db.auth.admin.getUserById(row.recipient_id);
        if (error || !user?.email) throw new Error("recipient-unavailable");
        if (row.delivery_payload && row.delivery_payload.to[0] !== user.email) {
          checked(
            await db
              .from("email_outbox")
              .update({
                needs_review: true,
                locked_until: null,
                last_error:
                  "Recipient address changed; review before resending",
              })
              .eq("id", row.id),
          );
          result.failed++;
          continue;
        }
        const subject =
          subjects[row.kind] || "An update from The Decision Room";
        const payload = row.delivery_payload || {
          from: process.env.MAIL_FROM!,
          to: [user.email],
          subject,
          text: `${subject}\n\n${event!.title}\n\nView your details securely: ${portalUrl()}/${event!.type === "dinner" ? "dinners" : "advisory-boards"}\n\nCupcakes + Broccoli`,
        };
        // Freeze the provider request before sending so retries reuse identical content.
        checked(
          await db
            .from("email_outbox")
            .update({
              delivery_payload: payload,
              delivery_unknown: true,
              ...(!row.delivery_payload
                ? { first_attempt_at: new Date().toISOString() }
                : {}),
            })
            .eq("id", row.id),
        );
        uncertain = true;
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          signal: AbortSignal.timeout(8000),
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": row.id,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 409
          )
            uncertain = row.delivery_unknown;
          throw new Error(`provider-${response.status}`);
        }
        checked(
          await db
            .from("email_outbox")
            .update({
              sent_at: new Date().toISOString(),
              delivery_unknown: false,
              locked_until: null,
              last_error: null,
            })
            .eq("id", row.id),
        );
        result.sent++;
      } catch (error) {
        const message =
          error instanceof Error &&
          /^provider-\d+$|^recipient-unavailable$/.test(error.message)
            ? error.message
            : "Delivery interrupted; retry pending";
        checked(
          await db
            .from("email_outbox")
            .update({
              delivery_unknown: uncertain,
              last_error: message,
              locked_until: null,
              next_attempt_at: new Date(Date.now() + 300000).toISOString(),
              needs_review: row.attempts >= 5,
            })
            .eq("id", row.id),
        );
        result.failed++;
        if (message === "provider-429") break;
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    result.deferred = Boolean(
      checked(
        await db
          .from("email_outbox")
          .select("id")
          .is("sent_at", null)
          .is("skipped_at", null)
          .eq("needs_review", false)
          .limit(1),
      ).length,
    );
    return result;
  } finally {
    checked(await db.rpc("stop_mail_worker", { worker }));
  }
}
