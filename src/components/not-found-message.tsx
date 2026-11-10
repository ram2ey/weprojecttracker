import Link from "next/link";

export function NotFoundMessage() {
  return (
    <>
      <span className="eyebrow">404</span>
      <h1>This page could not be found.</h1>
      <p>
        The address may have changed or the record is not available publicly.
      </p>
      <Link href="/" className="button button-primary">
        Return home
      </Link>
    </>
  );
}
