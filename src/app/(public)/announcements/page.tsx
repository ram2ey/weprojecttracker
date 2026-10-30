import { PublicationIndex } from "@/components/discovery/publication-index";
import { pageMetadata } from "@/lib/site";
export const metadata = pageMetadata(
  "Constituency announcements",
  "Independently reviewed announcements and information for communities in Wassa East.",
  "/announcements",
);
export default function Announcements({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PublicationIndex kind="announcement" searchParams={searchParams} />;
}
