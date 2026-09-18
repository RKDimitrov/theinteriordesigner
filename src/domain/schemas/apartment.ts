import { z } from "zod";
import { Degrees, Id } from "./common";

export const Tenure = z.enum(["rent", "own"]);
export type Tenure = z.infer<typeof Tenure>;

export const ApartmentInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  address: z.string().trim().max(200),
  city: z.string().trim().min(1, "City is required").max(100),
  /** ISO 3166-1 alpha-2, e.g. "DE". */
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use a 2-letter country code")
    .transform((c) => c.toUpperCase()),
  floorLevel: z.number().int().min(-2).max(100),
  tenure: Tenure,
  totalAreaM2: z.number().positive().max(2000),
  yearBuilt: z.number().int().min(1500).max(2100).nullable(),
  /** Direction of north, clockwise degrees from plan "up". 0 = north is up. */
  northAngleDeg: Degrees,
});
export type ApartmentInput = z.infer<typeof ApartmentInput>;

export const Apartment = ApartmentInput.extend({
  id: Id,
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});
export type Apartment = z.infer<typeof Apartment>;
