import { PublicationIndex } from "@/components/discovery/publication-index";
import { pageMetadata } from "@/lib/site";
export const metadata = pageMetadata(
  "Public reports",
  "Read independently approved public reports and supporting documents from Wassa East.",
  "/reports",
);
export default function Reports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PublicationIndex kind="report" searchParams={searchParams} />;
}
