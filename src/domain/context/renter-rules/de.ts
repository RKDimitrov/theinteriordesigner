import type { RenterRules } from "../../schemas/context";

/**
 * Typical constraints for tenants in Germany (Mietwohnung). General guidance,
 * not legal advice; the individual lease always wins.
 */
export const DE_RENTER_RULES: RenterRules["rules"] = [
  { id: "reversible", text: "Only reversible changes: everything must be removable without damage when you move out." },
  { id: "no-tile-drilling", text: "Do not drill into tiles (bath, kitchen splashback); use adhesive hooks, tension rods or freestanding pieces." },
  { id: "dowels", text: "A reasonable number of dowel holes in plaster walls is normally accepted for shelves, lamps and art; fill them at move-out." },
  { id: "walls-neutral", text: "Strong wall colours are allowed during the tenancy, but walls usually must be returned in light, neutral colours (Schönheitsreparaturen)." },
  { id: "floors", text: "No glued or nailed floor changes; use rugs or click/loose-lay flooring over the existing floor." },
  { id: "freestanding", text: "Prefer freestanding wardrobes, shelving and kitchen islands over built-ins." },
  { id: "ceiling", text: "Ceiling hooks and curtain rails are usually fine; plug-in or battery wall lights avoid new wiring." },
  { id: "wet-areas", text: "Keep radiators, sockets and ventilation openings free and accessible." },
];
