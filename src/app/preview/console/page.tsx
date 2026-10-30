import { notFound } from "next/navigation";
import { isDesignPreview } from "@/lib/env";
import { publicProjects } from "@/lib/projects";
import { Console } from "@/components/staff/console";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin design review",
  robots: { index: false, follow: false },
};
export default async function ConsolePreview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (!isDesignPreview()) notFound();
  const { view = "overview" } = await searchParams;
  return (
    <Console
      preview
      view={view}
      projects={publicProjects()}
      name="Project team"
      role="super_admin"
    />
  );
}
