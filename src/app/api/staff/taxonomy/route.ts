import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { taxonomy, auditLog } from "@/db/schema";
import { staffApi, jsonBody } from "@/lib/content/api";
import { ContentError, listTaxonomy } from "@/lib/content/service";
export function GET(request: Request) {
  return staffApi(request, async () => listTaxonomy());
}
export function POST(request: Request) {
  return staffApi(request, async (actor) => {
    if (actor.role !== "super_admin")
      throw new ContentError(
        403,
        "Only the operator can manage categories and communities.",
      );
    const input = z
      .object({
        id: z.string().max(100).optional(),
        kind: z.enum(["category", "subcategory", "community"]),
        name: z.string().trim().min(2).max(120),
        parentId: z.string().max(100).nullable().default(null),
        active: z.boolean().default(true),
      })
      .strict()
      .parse(await jsonBody(request));
    try {
      return await getDb().transaction(async (tx) => {
        if (input.kind === "subcategory") {
          const parent = input.parentId
            ? await tx.query.taxonomy.findFirst({
                where: eq(taxonomy.id, input.parentId),
              })
            : null;
          if (!parent?.active || parent.kind !== "category")
            throw new ContentError(400, "Choose an active parent category.");
        } else if (input.parentId)
          throw new ContentError(
            400,
            "Only subcategories can have a parent category.",
          );
        const id = input.id ?? crypto.randomUUID();
        if (input.id) {
          const old = await tx.query.taxonomy.findFirst({
            where: eq(taxonomy.id, id),
          });
          if (!old || old.kind !== input.kind)
            throw new ContentError(400, "Taxonomy type cannot be changed.");
          await tx
            .update(taxonomy)
            .set({
              name: input.name,
              parentId: input.parentId,
              active: input.active,
            })
            .where(eq(taxonomy.id, id));
        } else
          await tx.insert(taxonomy).values({
            id,
            kind: input.kind,
            name: input.name,
            parentId: input.parentId,
            active: input.active,
          });
        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          actorId: actor.id,
          action: input.id ? "taxonomy.updated" : "taxonomy.created",
          subjectId: id,
          details: {
            kind: input.kind,
            name: input.name,
            active: String(input.active),
          },
        });
        return { id };
      });
    } catch (error) {
      if (error instanceof ContentError) throw error;
      const code = error as { cause?: { code?: string }; code?: string };
      if (code.code === "23505" || code.cause?.code === "23505")
        throw new ContentError(
          409,
          "That name already exists in this category or community list.",
        );
      throw error;
    }
  });
}
