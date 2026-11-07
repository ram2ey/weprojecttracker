import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RetireOffline } from "@/components/retire-offline";
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
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
