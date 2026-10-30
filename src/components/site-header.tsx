"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Landmark,
  Menu,
  X,
  House,
  FolderOpen,
  Radio,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
const links = [
  { href: "/", label: "Home", icon: House },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/updates", label: "Updates", icon: Radio },
  { href: "/following", label: "Following", icon: Radio },
  { href: "/about", label: "About", icon: MoreHorizontal },
];
export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
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
          <Link href="/" className="brand">
            <span className="brand-mark">
              <Landmark size={23} strokeWidth={1.6} />
            </span>
            <span>
              Wassa East <span className="brand-subtitle">PROJECT TRACKER</span>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn("nav-link", active(link.href) && "active")}
                aria-current={path === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link href="/staff/login" className="staff-link">
            Staff access <ArrowUpRight size={15} />
          </Link>
          <button
            className="menu-button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Close navigation" : "Open navigation"}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav className="mobile-menu" aria-label="Mobile menu">
            {links.map((link) => (
              <Link
                href={link.href}
                key={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/staff/login" onClick={() => setOpen(false)}>
              Staff access
            </Link>
          </nav>
        )}
      </header>
      <nav className="bottom-nav" aria-label="Mobile primary navigation">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            className={active(href) ? "active" : ""}
            aria-current={path === href ? "page" : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
