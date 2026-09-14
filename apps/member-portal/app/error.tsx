"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>Something interrupted that request.</h1>
      <p>Please try again. If it continues, contact Amanda.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
