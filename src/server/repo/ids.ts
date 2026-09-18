import { z } from "zod";

const Uuid = z.uuid();

/** Ids come from URLs; Postgres rejects malformed UUIDs with an error, so check first. */
export const isUuid = (id: string): boolean => Uuid.safeParse(id).success;
