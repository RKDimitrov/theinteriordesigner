import type { Tenure } from "../../schemas/apartment";
import type { RenterRules } from "../../schemas/context";
import { DE_RENTER_RULES } from "./de";
import { DEFAULT_RENTER_RULES } from "./default";

const BY_COUNTRY: Readonly<Record<string, { drilling: RenterRules["drilling"]; rules: RenterRules["rules"] }>> = {
  DE: { drilling: "limited", rules: DE_RENTER_RULES },
};

/** Renter constraints for a country and tenure. Owners have no restrictions. */
export function renterRules(country: string, tenure: Tenure): RenterRules {
  const cc = country.toUpperCase();
  if (tenure === "own") return { applies: false, country: cc, drilling: "free", rules: [] };
  const specific = BY_COUNTRY[cc];
  return specific
    ? { applies: true, country: cc, drilling: specific.drilling, rules: specific.rules }
    : { applies: true, country: cc, drilling: "limited", rules: DEFAULT_RENTER_RULES };
}
