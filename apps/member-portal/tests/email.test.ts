import { beforeEach, afterEach, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  row: {} as Record<string, any>,
  claims: [] as Record<string, any>[],
  active: true,
  ackFailure: false,
  db: null as any,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("../lib/supabase", () => ({
  checked: (result: any) => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  },
  portalUrl: () => "https://portal.example.test",
  serviceDatabase: () => state.db,
}));
import { deliverEventEmails } from "../lib/email";
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-only");
  vi.stubEnv("MAIL_FROM", "test@example.test");
  state.active = true;
  state.ackFailure = false;
  state.row = {
    id: "90000000-0000-4000-8000-000000000001",
    recipient_id: "member",
    event_id: "event",
    kind: "event-reminder",
    attempts: 1,
    delivery_payload: null,
    delivery_unknown: false,
  };
  state.claims = [state.row];
  state.db = {
    rpc: vi.fn(async (name: string) => ({
      data:
        name === "start_mail_worker"
          ? true
          : name === "claim_portal_email"
            ? structuredClone(state.claims.splice(0, 1))
            : null,
      error: null,
    })),
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: "member@example.test" } },
          error: null,
        }),
      },
    },
    from: (table: string) => {
      let change: Record<string, any> | null = null,
        single = false;
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        limit: () => chain,
        maybeSingle: () => {
          single = true;
          return chain;
        },
        update: (value: any) => {
          change = value;
          return chain;
        },
        then: (resolve: any) => {
          if (change && table === "email_outbox") {
            if (change.sent_at && state.ackFailure) {
              state.ackFailure = false;
              return resolve({
                data: null,
                error: { message: "Persistence unavailable" },
              });
            }
            Object.assign(state.row, change);
            return resolve({ data: null, error: null });
          }
          const data =
            table === "memberships"
              ? { status: state.active ? "active" : "revoked" }
              : table === "events"
                ? {
                    title: "Board",
                    type: "board",
                    status: "published",
                    starts_at: "2099-01-01T12:00:00Z",
                  }
                : table === "event_rsvps"
                  ? { response: "yes" }
                  : single
                    ? null
                    : [];
          return resolve({ data, error: null });
        },
      };
      return chain;
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 200 })),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("delivers eligible mail with a stable provider key and frozen private-link payload", async () => {
  expect(await deliverEventEmails()).toMatchObject({ sent: 1, failed: 0 });
  const [, options] = vi.mocked(fetch).mock.calls[0];
  expect((options!.headers as Record<string, string>)["Idempotency-Key"]).toBe(
    state.row.id,
  );
  expect(JSON.parse(options!.body as string).text).toContain(
    "https://portal.example.test/advisory-boards",
  );
  expect(state.row.sent_at).toBeTruthy();
  expect(state.row.delivery_unknown).toBe(false);
  expect(state.db.rpc).toHaveBeenCalledWith(
    "stop_mail_worker",
    expect.anything(),
  );
});
it("an accepted email followed by a failed database acknowledgment is safely retryable", async () => {
  state.ackFailure = true;
  expect(await deliverEventEmails()).toMatchObject({ sent: 0, failed: 1 });
  expect(state.row.delivery_unknown).toBe(true);
  const first = vi.mocked(fetch).mock.calls[0][1];
  state.claims = [state.row];
  expect(await deliverEventEmails()).toMatchObject({ sent: 1 });
  const second = vi.mocked(fetch).mock.calls[1][1];
  expect(second!.body).toBe(first!.body);
  expect(second!.headers).toEqual(first!.headers);
});
it("network failures remain uncertain and exhaustion requires review", async () => {
  state.row.attempts = 5;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("network");
    }),
  );
  expect(await deliverEventEmails()).toMatchObject({ failed: 1 });
  expect(state.row.delivery_unknown).toBe(true);
  expect(state.row.needs_review).toBe(true);
});
it("revoked members are skipped rather than emailed or marked sent", async () => {
  state.active = false;
  expect(await deliverEventEmails()).toMatchObject({ sent: 0, skipped: 1 });
  expect(fetch).not.toHaveBeenCalled();
  expect(state.row.skipped_at).toBeTruthy();
  expect(state.row.sent_at).toBeUndefined();
});
it("provider rate limits stop the batch and missing configuration never sends", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 429 })),
  );
  expect(await deliverEventEmails()).toMatchObject({ failed: 1 });
  expect(state.row.delivery_unknown).toBe(false);
  vi.stubEnv("RESEND_API_KEY", "");
  expect(await deliverEventEmails()).toMatchObject({
    processed: 0,
    deferred: true,
  });
});
