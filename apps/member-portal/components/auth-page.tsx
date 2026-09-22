import Link from "next/link";
import { ActionForm } from "./form";
import { Field, Heading, ProfileFields, Shell } from "./ui";
import { configured, identity, checked } from "@/lib/supabase";
import type { Profile, Term } from "@/lib/types";
import { redirect } from "next/navigation";
export async function AuthPage({
  route,
  query,
}: {
  route: string;
  query: Record<string, string | string[] | undefined>;
}) {
  if (route === "setup")
    return (
      <Shell member={false}>
        <Heading
          title="The room is being prepared."
          body="The member area will open once its services are connected."
        />
        <p>
          For membership inquiries,{" "}
          <a
            href={`mailto:${process.env.SUPPORT_EMAIL || "amanda@cupcakesandbroccoli.com"}`}
          >
            contact Amanda
          </a>
          .
        </p>
      </Shell>
    );
  if (route === "privacy" || route === "terms") {
    const url =
      route === "privacy" ? process.env.PRIVACY_URL : process.env.TERMS_URL;
    if (url && /^https:\/\//.test(url) && new URL(url).pathname !== `/${route}`)
      redirect(url);
    const privacy = route === "privacy";
    return (
      <Shell member={false}>
        <Heading
          eyebrow="Staging draft / September 15, 2026"
          title={privacy ? "Privacy notice" : "Membership terms"}
          body="Prepared for Amanda's review before invitations are sent to actual members."
        />
        <article className="panel policy-copy">
          {privacy ? <PrivacyDraft /> : <TermsDraft />}
        </article>
      </Shell>
    );
  }
  if (route === "onboarding") {
    const { db, membership } = await identity();
    if (membership.status === "active") redirect("/");
    if (membership.status !== "invited") redirect("/account-status");
    const { user } = await identity();
    const p = checked(
      await db
        .from("member_profiles")
        .select(
          "user_id,display_name,title,company,bio,city,region,country,directory_visible,onboarding_complete,avatar_path",
        )
        .eq("user_id", user.id)
        .single(),
    ) as Profile;
    const terms = checked(
      await db
        .from("taxonomy_terms")
        .select("*")
        .eq("active", true)
        .order("display_order"),
    ) as Term[];
    return (
      <Shell member={false}>
        <Heading
          title="Make yourself at home."
          body="Introduce yourself to the women in the room."
        />
        <div className="panel form-panel">
          <ActionForm action="onboard" label="Enter the Decision Room">
            <ProfileFields profile={p} terms={terms} />
            <label className="check">
              <input name="consent" type="checkbox" required />
              <span>
                I accept the{" "}
                <a href="/terms" target="_blank" rel="noopener">
                  membership terms
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noopener">
                  privacy policy
                </a>
                .
              </span>
            </label>
          </ActionForm>
        </div>
      </Shell>
    );
  }
  if (route === "account-status") {
    await identity();
    return (
      <Shell member={false}>
        <Heading
          title="Your membership needs attention."
          body="Please contact Amanda about access to the room."
        />
        <ActionForm action="logout" label="Log out" />
      </Shell>
    );
  }
  const confirm = route === "auth/confirm" || route === "accept-invite";
  const reset = route === "reset-password";
  const forgot = route === "forgot-password";
  const title = confirm
    ? "Your place in the room."
    : reset
      ? "Set your password."
      : forgot
        ? "Let us help you back in."
        : "Welcome back.";
  return (
    <div className="auth-page">
      <aside className="auth-art">
        <a
          className="auth-wordmark"
          href="https://www.cupcakesandbroccoli.com"
          aria-label="Cupcakes and Broccoli website"
        >
          <img className="auth-logo" src="/images/cb-icon-white.png" alt="" />
          <span>cupcakes + broccoli</span>
        </a>
        <img
          className="auth-artwork"
          src="/images/member-home.webp"
          alt="The Decision Room artwork"
        />
        <h2>A place for better questions. And the women who ask them.</h2>
        <p className="eyebrow">The Decision Room</p>
      </aside>
      <main className="auth-content" id="main">
        <div>
          <p className="eyebrow">The Decision Room</p>
          <h1>{title}</h1>
          <p>
            {confirm
              ? "Continue to securely accept your invitation or reset your password."
              : reset
                ? "Choose a password with at least 12 characters."
                : forgot
                  ? "Enter your email and we will send a secure reset link."
                  : "What decision are you thinking through today?"}
          </p>
          {typeof query.message === "string" && (
            <p className="feedback" role="status">
              {query.message}
            </p>
          )}
          {!configured() ? (
            <p className="notice">
              Member login is being prepared.{" "}
              <a href="mailto:amanda@cupcakesandbroccoli.com">Contact Amanda</a>{" "}
              for access.
            </p>
          ) : (
            <ActionForm
              action={
                confirm
                  ? "confirm"
                  : reset
                    ? "reset"
                    : forgot
                      ? "forgot"
                      : "login"
              }
              label={
                confirm
                  ? "Continue securely"
                  : reset
                    ? "Set password"
                    : forgot
                      ? "Send reset link"
                      : "Log in"
              }
            >
              {confirm ? (
                <>
                  <input
                    type="hidden"
                    name="token_hash"
                    value={
                      typeof query.token_hash === "string"
                        ? query.token_hash
                        : ""
                    }
                  />
                  <input
                    type="hidden"
                    name="type"
                    value={
                      typeof query.type === "string" ? query.type : "invite"
                    }
                  />
                </>
              ) : reset ? (
                <>
                  <Field
                    name="password"
                    label="New password"
                    type="password"
                    required
                  />
                  <Field
                    name="confirm_password"
                    label="Confirm new password"
                    type="password"
                    required
                  />
                </>
              ) : (
                <>
                  <label>
                    Email address
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                    />
                  </label>
                  {!forgot && (
                    <>
                      <label>
                        Password
                        <input
                          type="password"
                          name="password"
                          autoComplete="current-password"
                          required
                        />
                      </label>
                      <input
                        type="hidden"
                        name="next"
                        value={
                          typeof query.next === "string" ? query.next : "/"
                        }
                      />
                    </>
                  )}
                </>
              )}
            </ActionForm>
          )}
          <div className="auth-links">
            <Link
              href={forgot || reset || confirm ? "/login" : "/forgot-password"}
            >
              {forgot || reset || confirm
                ? "Back to login"
                : "Forgot your password?"}
            </Link>
            <a href="https://www.cupcakesandbroccoli.com/membership">
              Explore membership
            </a>
          </div>
          <p className="auth-note">
            Membership is intentionally limited. Access begins with an
            invitation from Amanda.
          </p>
        </div>
      </main>
    </div>
  );
}

function PrivacyDraft() {
  return (
    <>
      <h2>How member information is handled</h2>
      <p>
        The Decision Room is a private, invitation-only community operated by
        Cupcakes + Broccoli. This notice describes the staging member portal
        and must be reviewed before launch.
      </p>
      <h3>Information we collect</h3>
      <p>
        We may collect account and profile details, directory preferences,
        discussion contributions, saved resources, introduction requests,
        event invitations and responses, dietary or accessibility notes, and
        security and administrative records.
      </p>
      <h3>How information is used</h3>
      <p>
        Information is used to operate membership, display profiles according
        to each member's visibility choice, facilitate conversations and
        introductions, manage gatherings, deliver requested communications,
        protect the community, and respond to support requests.
      </p>
      <h3>Access and service providers</h3>
      <p>
        Appropriate information may be available to other active members and
        authorized administrators. Infrastructure providers currently include
        Supabase, Vercel, Google Workspace, and Resend. Information is not
        placed in the public website workbook.
      </p>
      <h3>Choices, retention, and requests</h3>
      <p>
        Members control whether their profile appears in the directory and may
        request access, correction, export, or deletion. Final retention and
        deletion periods must be approved before launch, including treatment
        of conversations, event records, and backups.
      </p>
      <p>
        Questions or requests may be sent to{" "}
        <a href="mailto:amanda@cupcakesandbroccoli.com">
          amanda@cupcakesandbroccoli.com
        </a>
        .
      </p>
    </>
  );
}

function TermsDraft() {
  return (
    <>
      <h2>Participating in The Decision Room</h2>
      <p>
        The Decision Room is an invitation-only Cupcakes + Broccoli community.
        These staging terms must be reviewed before invitations are sent to
        actual members.
      </p>
      <h3>Membership and accounts</h3>
      <p>
        Access is personal, may not be shared, and remains subject to approval.
        Members must provide accurate information, protect their credentials,
        and promptly report suspected unauthorized access.
      </p>
      <h3>Community conduct</h3>
      <p>
        Members are expected to engage respectfully, avoid harassment and
        unlawful content, respect others' privacy, and follow published event
        and community guidelines. Access or content may be limited when needed
        to protect members or operate the community.
      </p>
      <h3>Confidentiality and introductions</h3>
      <p>
        Members should not disclose another person's private profile,
        conversation, event, or contact information without permission.
        Introductions are requests facilitated by Amanda; contact details are
        not automatically exchanged and no introduction or outcome is
        guaranteed.
      </p>
      <h3>Member contributions</h3>
      <p>
        Members retain ownership of their contributions while allowing
        Cupcakes + Broccoli to store and display them as needed to provide and
        moderate the member service. The portal does not provide legal,
        financial, medical, or other professional advice.
      </p>
      <h3>Changes and questions</h3>
      <p>
        Material changes should be communicated with a new policy version.
        Questions may be sent to{" "}
        <a href="mailto:amanda@cupcakesandbroccoli.com">
          amanda@cupcakesandbroccoli.com
        </a>
        .
      </p>
    </>
  );
}
