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
      throw new ContentError(403, "Operator access required.");
    const input = z
      .object({
        id: z.string().max(100).optional(),
        name: z.string().trim().min(2).max(120),
        active: z.boolean(),
      })
      .strict()
      .parse(await jsonBody(request));
    try {
      return await getDb().transaction(async (tx) => {
        const id = input.id ?? crypto.randomUUID();
        if (input.id) {
          const old = await tx.query.taxonomy.findFirst({
            where: eq(taxonomy.id, id),
          });
          if (old?.kind !== "community")
            throw new ContentError(400, "Only communities can be changed.");
          await tx
            .update(taxonomy)
            .set({ name: input.name, active: input.active })
            .where(eq(taxonomy.id, id));
        } else
          await tx.insert(taxonomy).values({
            id,
            kind: "community",
            name: input.name,
            active: input.active,
          });
        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          actorId: actor.id,
          subjectId: id,
          action: "community.saved",
          details: { name: input.name, active: String(input.active) },
        });
        return { id };
      });
    } catch (e) {
      const x = e as { code?: string; cause?: { code?: string } };
      if (x.code === "23505" || x.cause?.code === "23505")
        throw new ContentError(409, "That community name already exists.");
      throw e;
    }
  });
}
