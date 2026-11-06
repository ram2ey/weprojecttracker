import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/security/staff-session";
import { Console } from "@/components/staff/console";
import { RecordEditor } from "@/components/content/record-editor";
import {
  ContentError,
  getAdminRecord,
  listTaxonomy,
} from "@/lib/content/service";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Manage project",
  robots: { index: false, follow: false },
};
export default async function ProjectEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const identity = await requireStaff(),
    { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [record, terms] = await Promise.all([
      getAdminRecord(id).catch((e) => {
        if (e instanceof ContentError && e.status === 404) notFound();
        throw e;
      }),
      listTaxonomy(),
    ]),
    { revision } = await searchParams,
    selected = revision ?? record.revisions[0]?.id;
  if (!selected || !record.revisions.some((r) => r.id === selected)) notFound();
  return (
    <Console
      view={
        record.revisions.find((r) => r.id === selected)?.state === "pending"
          ? "review"
          : "projects"
      }
      name={identity.user.name}
      role={identity.staff.role}
    >
      <RecordEditor
        key={selected}
        record={record}
        revisionId={selected}
        terms={terms}
        actorId={identity.user.id}
        role={identity.staff.role}
      />
    </Console>
  );
}
