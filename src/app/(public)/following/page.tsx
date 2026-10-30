import { FollowingFeed } from "@/components/engagement/following-feed";
export const metadata = {
  title: "Following on this device",
  robots: { index: false, follow: true },
};
export default function Following() {
  return (
    <div className="container section">
      <span className="eyebrow">YOUR DEVICE</span>
      <h1>Your following feed.</h1>
      <FollowingFeed />
    </div>
  );
}
