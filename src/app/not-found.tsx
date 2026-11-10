import { NotFoundMessage } from "@/components/not-found-message";
import { CopyrightNotice } from "@/components/site-footer";
export default function NotFound() {
  return (
    <>
      <main id="main-content" className="container empty-state" tabIndex={-1}>
        <NotFoundMessage />
      </main>
      <footer className="site-footer">
        <CopyrightNotice />
      </footer>
    </>
  );
}
