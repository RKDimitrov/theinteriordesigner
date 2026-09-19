import { directionWord, type Overlap } from "../geometry/obb";

/** "move sofa ≥ 12 cm toward −x (left)" */
export function moveHint(name: string, o: Overlap): string {
  return `move ${name} at least ${Math.ceil(o.depth + 2)} cm toward ${directionWord(o.axis)}`;
}

export const cm = (n: number) => `${Math.round(n)} cm`;
export const eur = (n: number) => `€${Math.round(n).toLocaleString("en")}`;
