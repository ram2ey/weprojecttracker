"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { isUnread, useReadState, useSummary } from "./notification-client";

export function UpdatesBell() {
  const { feed } = useSummary();
  const read = useReadState();
  const pathname = usePathname();
  const unread = feed?.items.filter((item) => isUnread(item, read)).length ?? 0;
  const label =
    "Updates" +
    (unread ? `, ${unread >= 50 ? "50 or more" : unread} unread` : "");
  return (
    <Link
      href="/updates"
      className="updates-bell"
      aria-label={label}
      title={label}
      aria-current={pathname.startsWith("/updates") ? "page" : undefined}
    >
      <Bell aria-hidden="true" />
      {unread > 0 && (
        <span className="updates-bell-count" aria-hidden="true">
          {unread >= 50 ? "50+" : unread}
        </span>
      )}
    </Link>
  );
}
