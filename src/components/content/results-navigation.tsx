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
  children,
}: {
  slug: string;
  resultsHref: string;
  className?: string;
  children: ReactNode;
}) {
  const navigation = useContext(RegisterContext);
  return (
    <Link
      href={"/projects/" + slug}
      className={className}
      onNavigate={() => navigation?.remember({ slug, href: resultsHref })}
    >
      {children}
    </Link>
  );
}

export function RegisterReturnLink({ slug }: { slug: string }) {
  const origin = useContext(RegisterContext)?.origin;
  const href = origin?.slug === slug ? origin.href : "/";
  return (
    <Link href={href} className="text-link">
      ← {href === "/" ? "All projects" : "Back to results"}
    </Link>
  );
}
