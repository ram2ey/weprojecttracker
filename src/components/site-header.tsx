"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { SiteBrand } from "./site-brand";
import { InstallTracker } from "./install-tracker";
const links = [
  ["/", "Home"],
  ["/projects", "Projects"],
  ["/favourites", "Favourites"],
  ["/about", "About"],
  ["/contact", "Contact Us"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const lastFocused = useRef<EventTarget | null>(null);

  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        "--public-header-height",
        `${element.getBoundingClientRect().height}px`,
      );
    });
    observer.observe(element);
    const breakpoint = matchMedia("(max-width: 800px)");
    function rememberFocus(event: FocusEvent) {
      lastFocused.current = event.target;
    }
    function resize() {
      setOpen(false);
      // CSS can hide the focused control before the media-query event runs.
      const focused =
        document.activeElement === document.body
          ? lastFocused.current
          : document.activeElement;
      if (
        breakpoint.matches &&
        focused instanceof Node &&
        navigation.current?.contains(focused)
      ) {
        toggle.current?.focus();
      } else if (!breakpoint.matches && focused === toggle.current) {
        navigation.current?.querySelector("a")?.focus();
      }
    }
    document.addEventListener("focusin", rememberFocus);
    breakpoint.addEventListener("change", resize);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", rememberFocus);
      breakpoint.removeEventListener("change", resize);
      document.documentElement.style.removeProperty("--public-header-height");
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function outside(event: Event) {
      if (document.querySelector("[data-install-dialog]")) return;
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (document.querySelector("[data-install-dialog]")) return;
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    function historyNavigation() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("popstate", historyNavigation);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("popstate", historyNavigation);
    };
  }, [open]);

  return (
    <header
      className="site-header"
      ref={header}
      onClickCapture={(event) => {
        if (event.target instanceof Element && event.target.closest("a")) {
          setOpen(false);
        }
      }}
    >
      <div className="container header-inner">
        <SiteBrand />
        <button
          className="public-menu-toggle"
          ref={toggle}
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-controls="public-navigation"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav
          id="public-navigation"
          aria-label="Main navigation"
          ref={navigation}
          data-open={open}
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                pathname === href
                  ? "page"
                  : href !== "/" && pathname.startsWith(href + "/")
                    ? "location"
                    : undefined
              }
            >
              {label}
            </Link>
          ))}
          <InstallTracker />
        </nav>
      </div>
    </header>
  );
}
