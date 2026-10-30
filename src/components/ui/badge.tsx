import { cn } from "@/lib/utils";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={cn("badge", `badge-${tone}`)}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
