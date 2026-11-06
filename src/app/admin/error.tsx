"use client";
import Link from "next/link";
export default function StaffError({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="container section" role="alert">
      <h1>Workspace temporarily unavailable</h1>
      <p>Try again or return to the project register.</p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
      <Link href="/admin">Staff register</Link>
    </main>
  );
}
