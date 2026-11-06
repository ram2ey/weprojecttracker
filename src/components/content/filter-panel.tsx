"use client";
import { useSyncExternalStore, type ReactNode } from "react";
function subscribe(update: () => void) {
  const q = matchMedia("(max-width:560px)");
  q.addEventListener("change", update);
  return () => q.removeEventListener("change", update);
}
export function FilterPanel({
  children,
  count,
}: {
  children: ReactNode;
  count: number;
}) {
  const mobile = useSyncExternalStore(
    subscribe,
    () => matchMedia("(max-width:560px)").matches,
    () => false,
  );
  return (
    <details className="filter-panel" open={!mobile}>
      <summary>
        Filter projects{count ? " (" + count + " applied)" : ""}
      </summary>
      {children}
    </details>
  );
}
