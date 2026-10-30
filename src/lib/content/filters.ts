import { z } from "zod";
import { contentKinds, projectStatuses } from "./types";
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );
const optionalDate = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.iso.date().optional(),
);
export const publicFiltersSchema = z
  .object({
    kind: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.enum(contentKinds).optional(),
    ),
    q: optionalText(200),
    category: optionalText(120),
    subcategory: optionalText(120),
    community: optionalText(120),
    status: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.enum(projectStatuses).optional(),
    ),
    from: optionalDate,
    to: optionalDate,
    sort: z.enum(["newest", "oldest", "title", "progress"]).default("newest"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "The start of the update period must be before its end.",
    path: ["from"],
  });
export type PublicFilters = z.infer<typeof publicFiltersSchema>;
export function filterQuery(
  filters: Partial<PublicFilters> & { view?: string },
  patch: Record<string, string | undefined> = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...patch }))
    if (value !== undefined && value !== "" && key !== "kind")
      params.set(key, String(value));
  return params.toString();
}
