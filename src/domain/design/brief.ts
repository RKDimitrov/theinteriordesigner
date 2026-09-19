import type { DesignContext } from "../schemas/context";
import type { StyleProfile } from "../schemas/profile";

/** Everything about people, taste and surroundings the designer should know for one room. */
export function designBrief(roomId: string, ctx: DesignContext, profile: StyleProfile | null) {
  const daylight = ctx.rooms.find((r) => r.roomId === roomId) ?? null;
  const trends = ctx.trends;
  return {
    household: profile?.household ?? null,
    budgetEur: profile?.budgetPerRoom[roomId] ?? null,
    styles: ctx.topStyles.map((s) => ({ style: s.style, share: Math.round(s.score * 100) / 100 })),
    colorsLiked: profile?.colorsLiked ?? [],
    colorsDisliked: profile?.colorsDisliked ?? [],
    mustKeep: (profile?.mustKeep ?? [])
      .filter((m) => m.roomId === roomId)
      .map((m) => ({ name: m.name, category: m.category, w: m.w, d: m.d, h: m.h, colorHex: m.colorHex })),
    daylight: daylight && {
      level: daylight.level,
      mainWindowsFace: daylight.dominantOrientation,
      lightTemperature: daylight.lightTemperature,
      hint: daylight.hint,
    },
    climate: ctx.climate && { ...ctx.climate.classes, hints: ctx.climate.classes.hints },
    renter: ctx.renter.applies ? { drilling: ctx.renter.drilling, rules: ctx.renter.rules.map((r) => r.text) } : null,
    trends: trends && {
      lasting: trends.trends.filter((t) => t.longevity === "lasting").map((t) => `${t.name}: ${t.description}`),
      midTerm: trends.trends.filter((t) => t.longevity === "mid").map((t) => `${t.name}: ${t.description}`),
      shortLived: trends.trends.filter((t) => t.longevity === "fad").map((t) => `${t.name}: ${t.description}`),
      regionalCues: trends.regionalCues,
    },
    country: ctx.renter.country,
  };
}

export type DesignBrief = ReturnType<typeof designBrief>;
