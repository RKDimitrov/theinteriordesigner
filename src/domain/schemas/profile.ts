import { z } from "zod";
import { Hex, Id, PositiveCm } from "./common";
import { FurnitureCategory } from "./design";

export const StyleKey = z.enum([
  "scandinavian",
  "japandi",
  "mid_century",
  "industrial",
  "modern_classic",
  "boho",
  "minimal",
  "mediterranean",
]);
export type StyleKey = z.infer<typeof StyleKey>;

export const PetType = z.enum(["dog", "cat", "small", "other"]);
export type PetType = z.infer<typeof PetType>;

export const Household = z.object({
  adults: z.number().int().min(1, "At least one adult").max(12),
  kids: z.array(z.object({ age: z.number().int().min(0).max(17) })).max(10),
  pets: z.array(z.object({ type: PetType, count: z.number().int().min(1).max(10) })).max(10),
  wfhDaysPerWeek: z.number().int().min(0).max(7),
});
export type Household = z.infer<typeof Household>;

export const MustKeepItem = z.object({
  id: Id,
  name: z.string().trim().min(1, "Name is required").max(60),
  category: FurnitureCategory,
  w: PositiveCm,
  d: PositiveCm,
  h: PositiveCm,
  colorHex: Hex,
  /** Target room, or null when not assigned yet. */
  roomId: z.string().nullable(),
});
export type MustKeepItem = z.infer<typeof MustKeepItem>;

/** One quiz answer. `choice` null means the user skipped the pair. */
export const QuizAnswer = z.object({ pairId: z.string().min(1).max(32), choice: StyleKey.nullable() });
export type QuizAnswer = z.infer<typeof QuizAnswer>;

export const MAX_BUDGET_EUR = 200_000;

const lower = (hs: readonly string[]) => new Set(hs.map((h) => h.toLowerCase()));

/** What the client sends. Style scores are derived on the server from `quizAnswers`. */
export const StyleProfileInput = z
  .object({
    household: Household,
    /** roomId -> EUR */
    budgetPerRoom: z.record(z.string(), z.number().int().min(0).max(MAX_BUDGET_EUR)),
    quizAnswers: z.array(QuizAnswer).max(20),
    colorsLiked: z.array(Hex).max(12),
    colorsDisliked: z.array(Hex).max(12),
    mustKeep: z.array(MustKeepItem).max(30),
  })
  .superRefine((p, ctx) => {
    const liked = lower(p.colorsLiked);
    p.colorsDisliked.forEach((h, i) => {
      if (liked.has(h.toLowerCase())) {
        ctx.addIssue({ code: "custom", path: ["colorsDisliked", i], message: "Colour is both liked and disliked" });
      }
    });
    const ids = new Set<string>();
    p.mustKeep.forEach((m, i) => {
      if (ids.has(m.id)) ctx.addIssue({ code: "custom", path: ["mustKeep", i, "id"], message: "Duplicate id" });
      ids.add(m.id);
    });
  });
export type StyleProfileInput = z.infer<typeof StyleProfileInput>;

export const StyleScores = z.record(StyleKey, z.number().min(0).max(1));
export type StyleScores = z.infer<typeof StyleScores>;

/** Stored profile as returned by the repo. */
export type StyleProfile = StyleProfileInput & { apartmentId: string; scores: StyleScores };
