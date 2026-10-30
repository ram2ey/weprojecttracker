import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { isDesignPreview } from "@/lib/env";
import { isSampleDataset } from "@/lib/content/showcase";
import { PwaProvider } from "@/components/pwa/provider";
import { PushSync } from "@/components/engagement/push-sync";
export const dynamic = "force-dynamic";
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sample = await isSampleDataset().catch(() => false);
  return (
    <>
      <SiteHeader />
      <PwaProvider />
      <PushSync />
      {isDesignPreview() && (
        <div
          className="preview-notice"
          role="region"
          aria-label="Design preview notice"
        >
          <span className="preview-label">
            {sample ? "DESIGN PREVIEW" : "LOCAL REVIEW"}
          </span>
          <span>
            {sample
              ? "Sample records and illustrations · Not verified constituency projects"
              : "Local development · Only independently approved content is displayed"}
          </span>
          <Link href="/preview/console">
            Review admin design <span aria-hidden="true">↗</span>
          </Link>
        </div>
      )}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
