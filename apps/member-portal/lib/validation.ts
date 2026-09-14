import { z } from "zod";
export const uuid = z.string().uuid();
export const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128);
export const resourceTypes = [
  "Essay",
  "AI Prompt",
  "Decision Brief",
  "Business Case",
] as const;
export const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(100),
  title: z.string().trim().max(120),
  company: z.string().trim().max(160),
  bio: z.string().trim().max(3000),
  city: z.string().trim().max(100),
  region: z.string().trim().max(100),
  country: z.string().trim().max(100),
  directory_visible: z.boolean(),
});
export function safeNext(value: unknown, fallback = "/") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://portal.invalid");
    return url.origin === "https://portal.invalid"
      ? url.pathname + url.search
      : fallback;
  } catch {
    return fallback;
  }
}
export function httpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Use a complete HTTPS URL.");
  return url.toString();
}
export function calendarEvent(event: {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  location_label: string;
}) {
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, "\\$&");
  const date = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//C+B//Decision Room//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@cupcakesandbroccoli.com`,
    `DTSTAMP:${date(new Date().toISOString())}`,
    `DTSTART:${date(event.starts_at)}`,
    `DTEND:${date(event.ends_at)}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(event.description)}`,
    `LOCATION:${escape(event.location_label)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
