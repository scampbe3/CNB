"use client";
import { useEffect, useState } from "react";
export function LocalEventDate({
  event,
}: {
  event: { starts_at: string; timezone: string };
}) {
  const [zone, setZone] = useState(event.timezone);
  useEffect(
    () => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
    [],
  );
  return (
    <time dateTime={event.starts_at}>
      {new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: zone,
      }).format(new Date(event.starts_at))}{" "}
      ({zone})
    </time>
  );
}
