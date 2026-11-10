"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";

type Origin = { slug: string; href: string };
const RegisterContext = createContext<{
  origin: Origin | null;
  remember: (origin: Origin) => void;
} | null>(null);

export function ResultsNavigation({ children }: { children: ReactNode }) {
  const [origin, remember] = useState<Origin | null>(null);
  return (
    <RegisterContext.Provider value={{ origin, remember }}>
      {children}
    </RegisterContext.Provider>
  );
}

export function ProjectResultLink({
  slug,
  resultsHref,
  className,
  comments = false,
  commentsEnabled = true,
  label,
  children,
}: {
  slug: string;
  resultsHref: string;
  className?: string;
  comments?: boolean;
  commentsEnabled?: boolean;
  label?: string;
  children: ReactNode;
}) {
  const navigation = useContext(RegisterContext);
  return (
    <Link
      href={
        "/projects/" +
        slug +
        (comments
          ? commentsEnabled
            ? "#write-comment"
            : "#project-comments-title"
          : "")
      }
      aria-label={label}
      title={label}
      className={className}
      onNavigate={() => navigation?.remember({ slug, href: resultsHref })}
    >
      {children}
    </Link>
  );
}

export function RegisterReturnLink({ slug }: { slug: string }) {
  const origin = useContext(RegisterContext)?.origin;
  const href = origin?.slug === slug ? origin.href : "/projects";
  return (
    <Link href={href} className="text-link">
      ←{" "}
      {href === "/projects"
        ? "All projects"
        : href === "/favourites"
          ? "Back to favourites"
          : "Back to results"}
    </Link>
  );
}
