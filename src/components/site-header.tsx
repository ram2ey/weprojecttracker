"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  House,
  FolderOpen,
  Radio,
  MoreHorizontal,
} from "lucide-react";
import { AppearanceControl } from "./ui/appearance";
import { ResponsivePanel } from "./ui/responsive-panel";
import { cn } from "@/lib/utils";
import { SiteBrand } from "./site-brand";
import { motion, useReducedMotion } from "motion/react";
const links = [
  { href: "/", label: "Home", icon: House },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/updates", label: "Updates", icon: Radio },
  { href: "/following", label: "Following", icon: Radio },
  { href: "/about", label: "About", icon: MoreHorizontal },
];
export function SiteHeader() {
  const path = usePathname();
  const reduce = useReducedMotion();
  function active(href: string) {
    return href === "/"
      ? path === "/"
      : href === "/updates"
        ? ["/updates", "/announcements", "/reports", "/information/"].some(
            (prefix) => path.startsWith(prefix),
          )
        : path.startsWith(href);
  }
  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <SiteBrand />
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn("nav-link", active(link.href) && "active")}
                aria-current={path === link.href ? "page" : undefined}
              >
                {active(link.href) && (
                  <motion.span
                    className="navigation-selection"
                    layoutId={reduce ? undefined : "desktop-navigation"}
                    transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                    aria-hidden="true"
                  />
                )}
                {link.label}
              </Link>
            ))}
          </nav>
          <Link href="/staff/login" className="staff-link">
            Staff access <ArrowUpRight size={15} />
          </Link>
          <AppearanceControl />
          <ResponsivePanel title="Navigation" kind="navigation">
            <nav className="mobile-menu" aria-label="Mobile menu">
              {links.map((link) => (
                <Link
                  href={link.href}
                  key={link.href}
                  aria-current={active(link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/announcements">Announcements</Link>
              <Link href="/reports">Reports</Link>
              <Link href="/staff/login">Staff access</Link>
            </nav>
          </ResponsivePanel>
        </div>
      </header>
      <nav className="bottom-nav" aria-label="Mobile primary navigation">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            className={active(href) ? "active" : ""}
            aria-current={path === href ? "page" : undefined}
          >
            {active(href) && (
              <motion.span
                className="navigation-selection"
                layoutId={reduce ? undefined : "mobile-navigation"}
                transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                aria-hidden="true"
              />
            )}
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
