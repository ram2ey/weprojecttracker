"use client";
import { useEffect, useRef } from "react";
export function useUnsavedChanges(dirty: boolean) {
  const bypass = useRef(false);
  const ignorePop = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    const message = "You have unsaved changes. Leave without saving?";
    const before = (e: BeforeUnloadEvent) => {
      if (!bypass.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest("a[href]");
      if (
        !a ||
        a.getAttribute("target") === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      )
        return;
      const url = new URL((a as HTMLAnchorElement).href, location.href);
      if (url.pathname === location.pathname && url.search === location.search)
        return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      } else bypass.current = true;
    };
    const pop = () => {
      if (ignorePop.current) {
        ignorePop.current = false;
        return;
      }
      if (bypass.current) return;
      if (window.confirm(message)) {
        bypass.current = true;
        history.back();
      } else {
        ignorePop.current = true;
        history.forward();
      }
    };
    const leave = (e: Event) => {
      if (!window.confirm(message)) e.preventDefault();
    };
    // A same-document guard entry makes Back cancellable without losing React state.
    if (!history.state?.wassaDraftGuard)
      history.pushState(
        { ...history.state, wassaDraftGuard: true },
        "",
        location.href,
      );
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", pop);
    document.addEventListener("wassa-before-leave", leave);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", pop);
      document.removeEventListener("wassa-before-leave", leave);
      bypass.current = false;
    };
  }, [dirty]);
  return () =>
    !dirty || window.confirm("You have unsaved changes. Leave without saving?");
}
