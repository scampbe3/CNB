import Link from "next/link";
import { ActionForm } from "./form";
import type { Profile, Resource, Term } from "@/lib/types";
export function Heading({
  eyebrow,
  title,
  body,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  center?: boolean;
}) {
  return (
    <header className={`section-heading ${center ? "center" : ""}`}>
      <p className="eyebrow">{eyebrow || "The Decision Room"}</p>
      <h1>{title}</h1>
      {body && <p className="lede">{body}</p>}
    </header>
  );
}
export function PageHero({
  eyebrow,
  title,
  body,
  image,
  imageAlt,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  image: string;
  imageAlt: string;
}) {
  return (
    <section className="hero page-hero">
      <Heading eyebrow={eyebrow} title={title} body={body} />
      <img src={image} alt={imageAlt} />
    </section>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}
export function Field({
  name,
  label,
  defaultValue = "",
  type = "text",
  required = false,
  maxLength,
  minLength,
  min,
  max,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        minLength={minLength}
        min={min}
        max={max}
        autoComplete={type === "password" ? "new-password" : undefined}
      />
    </label>
  );
}
export function TextArea({
  name,
  label,
  defaultValue = "",
  maxLength = 3000,
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
        rows={4}
      />
    </label>
  );
}
export function ResourceCard({
  resource,
  saved = false,
  savedAt,
  member = true,
}: {
  resource: Resource;
  saved?: boolean;
  savedAt?: string;
  member?: boolean;
}) {
  return (
    <article className="resource-card">
      <div className="card-meta">
        <span className="eyebrow">{resource.type}</span>
        <span>{resource.access === "member" ? "For members" : "Public"}</span>
      </div>
      <h3>
        <Link href={`/library/${resource.slug}`}>{resource.title}</Link>
      </h3>
      <p>{resource.summary}</p>
      <div className="card-foot">
        <Link className="text-link" href={`/library/${resource.slug}`}>
          Open <span aria-hidden="true">&rarr;</span>
        </Link>
        {member ? (
          <ActionForm
            action="save"
            label={saved ? "Remove bookmark" : "Save"}
            className="compact"
          >
            <input type="hidden" name="id" value={resource.id} />
            <input type="hidden" name="saved" value={String(saved)} />
          </ActionForm>
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(`/library/${resource.slug}`)}`}
          >
            Log in to save
          </Link>
        )}
      </div>
      {savedAt && (
        <small>
          Saved{" "}
          {new Date(savedAt).toLocaleDateString("en-US", {
            dateStyle: "medium",
          })}
        </small>
      )}
    </article>
  );
}
export function ProfileFields({
  profile,
  terms,
  selected = [],
}: {
  profile: Partial<Profile>;
  terms: Term[];
  selected?: string[];
}) {
  return (
    <>
      <div className="fields-grid">
        <Field
          name="display_name"
          label="Your name"
          defaultValue={profile.display_name}
          required
          maxLength={100}
        />
        <Field
          name="title"
          label="Role or title"
          defaultValue={profile.title}
          maxLength={120}
        />
        <Field
          name="company"
          label="Company"
          defaultValue={profile.company}
          maxLength={160}
        />
        <Field
          name="city"
          label="City"
          defaultValue={profile.city}
          maxLength={100}
        />
        <Field
          name="region"
          label="State or region"
          defaultValue={profile.region}
          maxLength={100}
        />
        <Field
          name="country"
          label="Country"
          defaultValue={profile.country}
          maxLength={100}
        />
      </div>
      <TextArea name="bio" label="About you" defaultValue={profile.bio} />
      <p className="muted">
        Share a little about yourself, what you are building, and what brings
        you to The Decision Room.
      </p>
      <div className="fields-grid">
        {[
          "profession",
          "expertise",
          "institution",
          "education_group",
          "sorority",
          "military_service",
        ].map((kind) => (
          <fieldset key={kind}>
            <legend>{kind.replaceAll("_", " ")}</legend>
            {terms.filter((t) => t.kind === kind).length ? (
              <div className="check-options">
                {terms
                  .filter((t) => t.kind === kind)
                  .map((term) => (
                    <label className="check" key={term.id}>
                      <input
                        name="terms"
                        type="checkbox"
                        value={term.id}
                        defaultChecked={selected.includes(term.id)}
                      />
                      {term.label}
                    </label>
                  ))}
              </div>
            ) : (
              <p className="muted">Options will appear here when available.</p>
            )}
          </fieldset>
        ))}
      </div>
      <label className="check">
        <input
          type="checkbox"
          name="directory_visible"
          defaultChecked={profile.directory_visible}
        />
        Show my profile to other active members in the directory.
      </label>
      <p className="muted">
        Your email address and saved resources stay private. You can change
        directory visibility at any time.
      </p>
    </>
  );
}
export function Shell({
  children,
  member = true,
}: {
  children: React.ReactNode;
  member?: boolean;
}) {
  const links = member
    ? [
        ["/", "Home"],
        ["/library", "The Library"],
        ["/directory", "In the Room"],
        ["/advisory-boards", "Advisory Boards"],
        ["/community", "Discussions"],
        ["/dinners", "Dinners"],
      ]
    : [["/library", "The Library"]];
  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <a
            className="site-brand"
            href="https://www.cupcakesandbroccoli.com"
            aria-label="Cupcakes and Broccoli website"
          >
            <img className="site-logo" src="/images/cb-icon-white.png" alt="" />
            <span className="wordmark">
              Cupcakes <span>+</span> Broccoli
            </span>
          </a>
          <div className="site-header-controls">
            {member ? (
              <Link className="header-control" href="/account">
                Account
              </Link>
            ) : (
              <Link className="header-control" href="/login">
                Login
              </Link>
            )}
            <details className="portal-menu">
              <summary className="header-control">Menu</summary>
              <nav aria-label="Member navigation">
                {links.map(([href, label]) => (
                  <Link href={href} key={href}>
                    {label}
                  </Link>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>
      <div className="portal-layout">
        <main id="main">{children}</main>
      </div>
      <footer className="footer">
        <span>Cupcakes + Broccoli</span>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Membership terms</Link>
          <a
            href={`mailto:${process.env.SUPPORT_EMAIL || "amanda@cupcakesandbroccoli.com"}`}
          >
            Contact Amanda
          </a>
        </div>
      </footer>
    </>
  );
}
