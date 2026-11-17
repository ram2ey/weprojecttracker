"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Ellipsis, FolderOpen, Heart, Newspaper } from "lucide-react";
import { appModeValue, appStartPath } from "@/lib/app-mode";

// The inline app-mode script sets this before hydration; it never changes later.
export function useAppMode() {
  return useSyncExternalStore(
    () => () => {},
    () => document.documentElement.dataset.app === appModeValue,
    () => false,
  );
}

const tabs = [
  { href: "/news", label: "News", Icon: Newspaper, match: ["/news"] },
  {
    href: "/projects",
    label: "Projects",
    Icon: FolderOpen,
    match: ["/projects"],
  },
  { href: "/favourites", label: "Saved", Icon: Heart, match: ["/favourites"] },
  {
    href: "/more",
    label: "More",
    Icon: Ellipsis,
    match: ["/more", "/contact", "/privacy", "/updates", "/about", "/faq"],
  },
] as const;

// Always rendered; CSS shows it only in app mode.
export function AppTabBar() {
  const pathname = usePathname();
  const app = useAppMode();
  const router = useRouter();
  useEffect(() => {
    // Links to the homepage (brand, error pages) land on News inside the app.
    if (app && pathname === "/") router.replace(appStartPath);
  }, [app, pathname, router]);
  return (
    <nav className="app-tabbar app-only" aria-label="App">
      {tabs.map(({ href, label, Icon, match }) => {
        const active = match.some(
          (path) => pathname === path || pathname.startsWith(path + "/"),
        );
        return (
          <Link
            key={href}
            href={href}
            aria-current={
              pathname === href ? "page" : active ? "location" : undefined
            }
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
