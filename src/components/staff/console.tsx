"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { SiteBrand } from "../site-brand";
import { Button } from "../ui/button";
import type { Role } from "@/lib/security/policy";
import { signOut, signOutErrorMessage } from "./sign-out";
export function Console({
  view,
  name,
  role,
  children,
}: {
  view: string;
  name: string;
  role: Role;
  children: ReactNode;
}) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [signingOut, setSigningOut] = useState(false);
  const links = [
    { key: "projects", label: "Projects" },
    { key: "review", label: "Review queue" },
    ...(role === "super_admin"
      ? [
          { key: "taxonomy", label: "Communities" },
          { key: "team", label: "Staff" },
          { key: "audit", label: "Audit log" },
          { key: "analytics", label: "Website statistics" },
        ]
      : []),
  ];
  return (
    <div className="console-shell">
      <aside className="console-sidebar">
        <SiteBrand staff />
        <nav aria-label="Staff navigation">
          {links.map((l) => (
            <Link
              key={l.key}
              href={"/admin?view=" + l.key}
              aria-current={view === l.key ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p>
          {name}
          <br />
          <small>
            {role === "super_admin"
              ? "Operator"
              : role === "officer"
                ? "Editor"
                : "Approver"}
          </small>
        </p>
        <Link href="/staff/password">Change password</Link>
        <Link href="/">Public register ↗</Link>
        <Button
          variant="outline"
          disabled={signingOut}
          onClick={async () => {
            if (
              !document.dispatchEvent(
                new Event("wassa-before-leave", { cancelable: true }),
              )
            )
              return;
            setError("");
            setSigningOut(true);
            try {
              await signOut();
              router.replace("/staff/login");
              router.refresh();
            } catch {
              setError(signOutErrorMessage);
            } finally {
              setSigningOut(false);
            }
          }}
        >
          Sign out
        </Button>
        {error && <p role="alert">{error}</p>}
      </aside>
      <main id="main-content" tabIndex={-1} className="console-main">
        {children}
      </main>
    </div>
  );
}
