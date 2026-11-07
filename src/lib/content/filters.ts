import { z } from "zod";
import { projectStatuses } from "./types";
const optional = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().trim().max(120).optional(),
);
export const publicFiltersSchema = z
  .object({
    q: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().trim().max(200).optional(),
    ),
    category: optional,
    community: optional,
    status: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.enum(projectStatuses).optional(),
    ),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
export type PublicFilters = z.infer<typeof publicFiltersSchema>;
// Page URLs may include campaign or social tracking parameters. Keep the API
// schema strict, while validating only the register controls on public pages.
export function parsePageFilters(query: Record<string, unknown>) {
  const { q, category, community, status, page } = query;
  return publicFiltersSchema.safeParse({
    q,
    category,
    community,
    status,
    page,
  });
}
export function filterQuery(
  filters: Partial<PublicFilters>,
  patch: Record<string, string | undefined> = {},
) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filters, ...patch }))
    if (v !== undefined && v !== "") p.set(k, String(v));
  return p.toString();
}
