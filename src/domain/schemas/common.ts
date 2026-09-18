import { z } from "zod";

/** Integer length in centimetres. All geometry in the app uses cm. */
export const Cm = z.number().int().nonnegative();
export const PositiveCm = z.number().int().positive();

/** Room-local coordinate: origin top-left, x right, y down (SVG convention). */
export const Point = z.object({ x: z.number(), y: z.number() });
export type Point = z.infer<typeof Point>;

export const Polygon = z.array(Point).min(3).max(64);
export type Polygon = z.infer<typeof Polygon>;

export const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Expected #RRGGBB");

/** Degrees in [0, 360). */
export const Degrees = z.number().min(0).lt(360);

export const Id = z.string().min(1).max(64);
