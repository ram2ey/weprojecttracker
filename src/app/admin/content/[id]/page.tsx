import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/security/staff-session";
import { Console } from "@/components/staff/console";
import { RecordEditor } from "@/components/content/record-editor";
import { RecordSettings } from "@/components/engagement/record-settings";
import {
  ContentError,
  getAdminRecord,
  listTaxonomy,
} from "@/lib/content/service";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Manage record",
  robots: { index: false, follow: false },
};
export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const identity = await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { revision } = await searchParams;
  const [record, terms] = await Promise.all([
    getAdminRecord(id).catch((error) => {
      if (error instanceof ContentError && error.status === 404) notFound();
      throw error;
    }),
    listTaxonomy(),
  ]);
  if (revision && !record.revisions.some((r) => r.id === revision)) notFound();
  const selected = revision ?? record.revisions[0].id;
  return (
    <Console
      preview={false}
      view={
        record.revisions.find((r) => r.id === selected)?.state === "pending"
          ? "review"
          : "projects"
      }
      name={identity.user.name}
      role={identity.staff.role}
      projects={[]}
    >
      <RecordEditor
        key={selected}
        record={record}
        revisionId={selected}
        terms={terms}
        actorId={identity.user.id}
        role={identity.staff.role}
      />
      {record.kind === "project" && (
        <RecordSettings
          recordId={record.id}
          commentsEnabled={record.commentsEnabled}
          reminderDays={record.reminderDays}
          version={record.engagementVersion}
          editable={["approver", "super_admin"].includes(identity.staff.role)}
        />
      )}
    </Console>
  );
}
