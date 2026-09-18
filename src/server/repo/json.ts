import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Values passed here are already Zod-validated domain objects (plain data),
 * which is exactly what a Json column accepts.
 */
export function toJson<T extends object>(value: T): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
