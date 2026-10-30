"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function PublicError({ reset }: { reset: () => void }) {
  return (
    <div className="container section empty-state" role="alert">
      <span className="eyebrow">PLEASE TRY AGAIN</span>
      <h1>Published information is temporarily unavailable.</h1>
      <p>We could not load the latest records. Please retry in a moment.</p>
      <div className="action-row">
        <Button onClick={reset}>Try again</Button>
        <Link className="text-link" href="/">
          Return home
        </Link>
      </div>
    </div>
  );
}
