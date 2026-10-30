import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="container empty-state" tabIndex={-1}>
      <span className="eyebrow">404</span>
      <h1>This page could not be found.</h1>
      <p>
        The address may have changed or the record is not available publicly.
      </p>
      <Link href="/" className="button button-primary">
        Return home
      </Link>
    </main>
  );
}
