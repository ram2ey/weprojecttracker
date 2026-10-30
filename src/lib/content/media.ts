import sharp from "sharp";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve, sep, dirname } from "node:path";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  mediaFile,
  contentRecord,
  contentRevision,
  auditLog,
} from "@/db/schema";
import { canSubmit } from "@/lib/security/policy";
import { ContentError, type Actor } from "./service";

export function mediaPath(key: string) {
  // Runtime-only volume, never an input to the standalone application bundle.
  const root = resolve(
    /* turbopackIgnore: true */ process.env.MEDIA_ROOT || ".local/media",
  );
  const path = resolve(root, key);
  if (!path.startsWith(root + sep))
    throw new ContentError(400, "Invalid storage key.");
  return path;
}
export async function processEvidence(
  bytes: Buffer,
  originalName: string,
  claimedType: string,
) {
  if (!bytes.length) throw new ContentError(400, "The file is empty.");
  const extension = originalName.split(".").pop()?.toLowerCase();
  const pdf = bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (pdf) {
    if (
      extension !== "pdf" ||
      bytes.length > 20 * 1024 * 1024 ||
      !["application/pdf", "application/octet-stream", ""].includes(claimedType)
    )
      throw new ContentError(
        400,
        "PDF documents must be valid .pdf files no larger than 20 MB.",
      );
    try {
      const document = await PDFDocument.load(bytes, {
        updateMetadata: false,
        throwOnInvalidObject: true,
      });
      if (
        document.isEncrypted ||
        document.getPageCount() > 500 ||
        document.getPageCount() < 1
      )
        throw new Error("unsupported PDF");
      const blocked = new Set([
        "JS",
        "JavaScript",
        "OpenAction",
        "AA",
        "EmbeddedFiles",
        "RichMedia",
        "XFA",
      ]);
      for (const [, object] of document.context.enumerateIndirectObjects()) {
        if (object instanceof PDFDict) {
          for (const key of object.keys())
            if (blocked.has(key.decodeText())) throw new Error("active PDF");
          const action = object.get(PDFName.of("S"));
          if (
            action instanceof PDFName &&
            ["JavaScript", "Launch", "SubmitForm", "ImportData"].includes(
              action.decodeText(),
            )
          )
            throw new Error("active PDF");
        }
      }
    } catch {
      throw new ContentError(
        400,
        "This PDF is invalid, encrypted, too large, or contains active scripts or embedded files. Upload a standard static PDF.",
      );
    }
    return {
      full: bytes,
      thumbnail: null,
      mimeType: "application/pdf",
      extension: "pdf",
    };
  }
  const format = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "jpeg"
      : bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
          bytes.subarray(8, 12).toString("ascii") === "WEBP"
        ? "webp"
        : null;
  if (
    !format ||
    bytes.length > 10 * 1024 * 1024 ||
    ![format, ...(format === "jpeg" ? ["jpg"] : [])].includes(
      extension ?? "",
    ) ||
    ![`image/${format}`, "application/octet-stream", ""].includes(claimedType)
  )
    throw new ContentError(
      400,
      "Upload a JPEG, PNG, or WebP image no larger than 10 MB, or a standard PDF up to 20 MB.",
    );
  try {
    const image = sharp(bytes, {
      limitInputPixels: 40_000_000,
      failOn: "warning",
      animated: false,
    }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1)
      throw new Error("unsupported image");
    // No keepMetadata/withMetadata call: EXIF/GPS and other source metadata are stripped.
    const full = await image
      .clone()
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .timeout({ seconds: 8 })
      .toBuffer();
    const thumbnail = await image
      .clone()
      .resize({
        width: 640,
        height: 480,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .timeout({ seconds: 8 })
      .toBuffer();
    return { full, thumbnail, mimeType: "image/webp", extension: "webp" };
  } catch {
    throw new ContentError(
      400,
      "The image could not be decoded safely. Use a standard non-animated image under 40 megapixels.",
    );
  }
}
export async function storeEvidence(
  actor: Actor,
  recordId: string,
  file: File,
  internalOnly: boolean,
) {
  if (!canSubmit(actor.role))
    throw new ContentError(
      403,
      "Only officers and operators can upload evidence.",
    );
  const db = getDb();
  const record = await db.query.contentRecord.findFirst({
    where: eq(contentRecord.id, recordId),
  });
  if (!record) throw new ContentError(404, "Record not found.");
  const activeDraft = await db.query.contentRevision.findFirst({
    where: and(
      eq(contentRevision.recordId, recordId),
      eq(contentRevision.state, "draft"),
    ),
  });
  if (!activeDraft)
    throw new ContentError(
      409,
      "Create or open an editable draft before uploading evidence.",
    );
  if (file.size > 20 * 1024 * 1024)
    throw new ContentError(413, "The file exceeds the upload size limit.");
  const processed = await processEvidence(
    Buffer.from(await file.arrayBuffer()),
    file.name,
    file.type,
  );
  const id = crypto.randomUUID();
  const key = `${recordId}/${id}.${processed.extension}`;
  const thumbnailKey = processed.thumbnail
    ? `${recordId}/${id}.thumb.webp`
    : null;
  const fullPath = mediaPath(key);
  await mkdir(dirname(fullPath), { recursive: true });
  const originalName =
    file.name.replace(/[\x00-\x1f\x7f/\\]/g, "").slice(0, 180) ||
    `evidence.${processed.extension}`;
  try {
    await writeFile(fullPath, processed.full, { flag: "wx", mode: 0o600 });
    if (thumbnailKey)
      await writeFile(mediaPath(thumbnailKey), processed.thumbnail!, {
        flag: "wx",
        mode: 0o600,
      });
    await db.transaction(async (tx) => {
      await tx
        .select()
        .from(contentRecord)
        .where(eq(contentRecord.id, recordId))
        .for("update");
      const editable = await tx
        .select()
        .from(contentRevision)
        .where(
          and(
            eq(contentRevision.recordId, recordId),
            eq(contentRevision.state, "draft"),
          ),
        );
      if (!editable.length)
        throw new ContentError(
          409,
          "The draft was submitted during upload. Create a new draft before attaching more files.",
        );
      await tx
        .update(contentRevision)
        .set({
          contributors: [...new Set([...editable[0].contributors, actor.id])],
        })
        .where(eq(contentRevision.id, editable[0].id));
      const count = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(mediaFile)
        .where(eq(mediaFile.recordId, recordId));
      if (count[0].count >= 100)
        throw new ContentError(
          400,
          "This record has reached its 100-file upload limit. Contact the operator.",
        );
      await tx.insert(mediaFile).values({
        id,
        recordId,
        uploadedBy: actor.id,
        originalName,
        mimeType: processed.mimeType,
        size: processed.full.length,
        storageKey: key,
        thumbnailKey,
        internalOnly,
      });
      await tx.insert(auditLog).values({
        id: crypto.randomUUID(),
        actorId: actor.id,
        action: "media.uploaded",
        subjectId: recordId,
        details: { mediaId: id, internalOnly: String(internalOnly) },
      });
    });
  } catch (error) {
    await unlink(fullPath).catch(() => undefined);
    if (thumbnailKey)
      await unlink(mediaPath(thumbnailKey)).catch(() => undefined);
    throw error;
  }
  return {
    id,
    originalName,
    mimeType: processed.mimeType,
    size: processed.full.length,
    internalOnly,
    withdrawn: false,
  };
}
export async function isPublicEvidence(id: string) {
  const db = getDb();
  const file = await db.query.mediaFile.findFirst({
    where: and(
      eq(mediaFile.id, id),
      isNull(mediaFile.withdrawnAt),
      eq(mediaFile.internalOnly, false),
    ),
  });
  if (!file) return false;
  const [record] = await db
    .select({ publishedNumber: contentRevision.number })
    .from(contentRecord)
    .innerJoin(
      contentRevision,
      eq(contentRecord.publishedRevisionId, contentRevision.id),
    )
    .where(
      and(
        eq(contentRecord.id, file.recordId),
        eq(contentRevision.recordId, file.recordId),
        eq(contentRevision.state, "approved"),
        sql`NOT EXISTS (SELECT 1 FROM report_source rs JOIN content_record sr ON sr.id=rs.source_record_id WHERE rs.report_record_id=${contentRecord.id} AND (sr.withdrawn_at IS NOT NULL OR sr.published_revision_id IS NULL))`,
        isNull(contentRecord.withdrawnAt),
      ),
    );
  if (!record) return false;
  const revisions = await db
    .select({ payload: contentRevision.payload })
    .from(contentRevision)
    .where(
      and(
        eq(contentRevision.recordId, file.recordId),
        eq(contentRevision.state, "approved"),
        sql`${contentRevision.number} <= ${record.publishedNumber}`,
      ),
    );
  return revisions.some((r) =>
    r.payload.attachments.some(
      (a) =>
        a.id === id && a.visibility === "public" && a.purpose !== "financial",
    ),
  );
}
export async function withdrawEvidence(
  actor: Actor,
  id: string,
  reason: string,
) {
  if (!["approver", "super_admin"].includes(actor.role))
    throw new ContentError(403, "Approver access required.");
  return getDb().transaction(async (tx) => {
    const [file] = await tx
      .select()
      .from(mediaFile)
      .where(eq(mediaFile.id, id));
    if (!file) throw new ContentError(404, "Attachment not found.");
    await tx
      .select()
      .from(contentRecord)
      .where(eq(contentRecord.id, file.recordId))
      .for("update");
    await tx
      .update(mediaFile)
      .set({
        withdrawnAt: new Date(),
        withdrawalReason: reason,
        withdrawnBy: actor.id,
      })
      .where(eq(mediaFile.id, id));
    // Invalidate every draft/pending base so a withdrawal cannot be silently undone.
    await tx
      .update(contentRecord)
      .set({ version: sql`${contentRecord.version} + 1` })
      .where(eq(contentRecord.id, file.recordId));
    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: "media.withdrawn",
      subjectId: file.recordId,
      details: { mediaId: id, reason },
    });
    return { withdrawn: true };
  });
}
