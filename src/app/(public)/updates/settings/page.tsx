import { NotificationSettings } from "@/components/notifications/notification-settings";
import { fixedCategories } from "@/lib/content/validation";
import { pageMetadata } from "@/lib/site";

export const metadata = {
  ...pageMetadata(
    "Notification settings",
    "Choose which Wassa East updates this device is notified about.",
    "/updates/settings",
  ),
  robots: { index: false, follow: false },
};

export default function NotificationSettingsPage() {
  return (
    <NotificationSettings
      categories={fixedCategories.map(({ id, name }) => ({ id, name }))}
    />
  );
}
