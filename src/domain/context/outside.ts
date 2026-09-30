import { z } from "zod";

/*
 * What lies outside the apartment: the kind of area, water or mountains
 * nearby, and what each wall looks onto. The 3D view no longer shows any of
 * it; the schemas stay so the stored values keep parsing.
 */

export const SurroundingsKind = z.enum(["city_centre", "urban", "suburban", "rural"]);
export type SurroundingsKind = z.infer<typeof SurroundingsKind>;

export const Surroundings = z.object({
  kind: SurroundingsKind.default("urban"),
  waterfront: z.boolean().default(false),
  mountains: z.boolean().default(false),
});
export type Surroundings = z.infer<typeof Surroundings>;

export const Outlook = z.enum(["street", "courtyard", "garden", "open"]);
export type Outlook = z.infer<typeof Outlook>;

/** What each wall looks onto, keyed by wall index; unset walls take the area's default. */
export const WallOutlooks = z.record(z.string().regex(/^\d{1,2}$/), Outlook);
export type WallOutlooks = z.infer<typeof WallOutlooks>;
