import { UpdatesFeed } from "@/components/notifications/updates-feed";
import { pageMetadata } from "@/lib/site";

export const metadata = {
  ...pageMetadata(
    "Updates",
    "New projects, project changes and news from Wassa East.",
    "/updates",
  ),
  robots: { index: false, follow: true },
};

export default function UpdatesPage() {
  return <UpdatesFeed />;
}
