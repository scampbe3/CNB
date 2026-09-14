import Link from "next/link";
export default function NotFound() {
  return (
    <main>
      <h1>We could not find that page.</h1>
      <p>It may have moved or may not be available to your account.</p>
      <Link href="/">Return to Member Home</Link>
    </main>
  );
}
