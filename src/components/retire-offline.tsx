"use client";
import { useEffect } from "react";
export function RetireOffline() {
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .getRegistration("/")
        .then((r) =>
          r?.active?.scriptURL === location.origin + "/sw.js"
            ? r.update()
            : undefined,
        )
        .catch(() => {});
  }, []);
  return null;
}
