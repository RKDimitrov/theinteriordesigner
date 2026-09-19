import type { RenterRules } from "../../schemas/context";

/** Conservative rules for renters in countries without a specific ruleset. */
export const DEFAULT_RENTER_RULES: RenterRules["rules"] = [
  { id: "reversible", text: "Prefer reversible changes that can be undone at move-out." },
  { id: "minimal-drilling", text: "Keep drilling to a minimum; use adhesive hooks, picture rails, leaning mirrors and freestanding lamps." },
  { id: "walls-neutral", text: "Check your lease before painting; plan to return walls to their original colour." },
  { id: "floors", text: "Cover floors with rugs instead of replacing them." },
  { id: "freestanding", text: "Choose freestanding furniture over built-ins." },
];
