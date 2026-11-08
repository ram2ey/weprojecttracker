import { ResultsNavigation } from "@/components/content/results-navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RetireOffline } from "@/components/retire-offline";
import { CookieConsent } from "@/components/cookie-consent";
export const dynamic = "force-dynamic";
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <RetireOffline />
      <main id="main-content" tabIndex={-1}>
        <ResultsNavigation>{children}</ResultsNavigation>
      </main>
      <SiteFooter />
      <CookieConsent />
    </>
  );
}
