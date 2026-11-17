import { headers } from "next/headers";
import { ResultsNavigation } from "@/components/content/results-navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OfflineSupport } from "@/components/offline-support";
import { CookieConsent } from "@/components/cookie-consent";
import { NotificationInvite } from "@/components/notifications/notification-invite";
import { AppDownloads } from "@/components/homepage-sections";
import { AppTabBar } from "@/components/app-shell";
import { androidPackage, appModeScript } from "@/lib/app-mode";
export const dynamic = "force-dynamic";
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <script
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: appModeScript(androidPackage()) }}
      />
      <SiteHeader />
      <OfflineSupport />
      <main id="main-content" tabIndex={-1}>
        <ResultsNavigation>{children}</ResultsNavigation>
        <div className="web-only">
          <AppDownloads />
        </div>
      </main>
      <SiteFooter />
      <AppTabBar />
      <CookieConsent />
      <NotificationInvite />
    </>
  );
}
