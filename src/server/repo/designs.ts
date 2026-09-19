import "server-only";
import { z } from "zod";
import type { Design as DesignRow } from "@/generated/prisma/client";
import { DesignContent } from "@/domain/schemas/design";
import { ValidationIssue } from "@/domain/schemas/validation-issue";
import { db } from "../db";
import { isUuid } from "./ids";
import { toJson } from "./json";

export const DesignStatus = z.enum(["valid", "valid_with_warnings", "invalid"]);
export type DesignStatus = z.infer<typeof DesignStatus>;

const Validation = z.object({ status: DesignStatus, issues: z.array(ValidationIssue), repairAttempts: z.number().int().min(0) });
const Source = z.object({ model: z.string(), promptId: z.string(), promptVersion: z.string() });

export interface StoredDesign {
  id: string;
  roomId: string;
  version: number;
  parentVersion: number | null;
  content: DesignContent;
  validation: z.infer<typeof Validation>;
  source: z.infer<typeof Source>;
  costEstimateEur: number;
  durationMs: number;
  createdAt: Date;
}

function toDomain(row: DesignRow): StoredDesign {
  return {
    id: row.id,
    roomId: row.roomId,
    version: row.version,
    parentVersion: row.parentVersion,
    content: DesignContent.parse(row.content),
    validation: Validation.parse(row.validation),
    source: Source.parse(row.source),
    costEstimateEur: row.costEstimateEur,
    durationMs: row.durationMs,
    createdAt: row.createdAt,
  };
}

const owned = (userId: string, roomId: string) => ({ roomId, room: { apartment: { userId } } });

export async function listVersions(userId: string, roomId: string): Promise<{ version: number; status: DesignStatus; createdAt: Date }[]> {
  if (!isUuid(roomId)) return [];
  const rows = await db.design.findMany({ where: owned(userId, roomId), orderBy: { version: "desc" }, select: { version: true, status: true, createdAt: true } });
  return rows.map((r) => ({ version: r.version, status: DesignStatus.parse(r.status), createdAt: r.createdAt }));
}

/** A specific version, or the latest when `version` is undefined. */
export async function getDesign(userId: string, roomId: string, version?: number): Promise<StoredDesign | null> {
  if (!isUuid(roomId)) return null;
  const row = await db.design.findFirst({
    where: { ...owned(userId, roomId), ...(version !== undefined ? { version } : {}) },
    orderBy: { version: "desc" },
  });
  return row ? toDomain(row) : null;
}

export interface NewDesign {
  content: DesignContent;
  validation: z.infer<typeof Validation>;
  source: z.infer<typeof Source>;
  costEstimateEur: number;
  durationMs: number;
  parentVersion: number | null;
}

/** Save as the room's next version. Returns null when the room is not the user's. */
export async function createDesign(userId: string, roomId: string, d: NewDesign): Promise<StoredDesign | null> {
  if (!isUuid(roomId)) return null;
  const room = await db.room.findFirst({ where: { id: roomId, apartment: { userId } }, select: { id: true } });
  if (!room) return null;
  const last = await db.design.findFirst({ where: { roomId }, orderBy: { version: "desc" }, select: { version: true } });
  const row = await db.design.create({
    data: {
      roomId,
      version: (last?.version ?? 0) + 1,
      parentVersion: d.parentVersion,
      content: toJson(d.content),
      validation: toJson(d.validation),
      status: d.validation.status,
      source: toJson(d.source),
      costEstimateEur: d.costEstimateEur,
      durationMs: Math.round(d.durationMs),
    },
  });
  return toDomain(row);
}

/** Latest status per room of an apartment. */
export async function latestStatusByRoom(userId: string, apartmentId: string): Promise<Map<string, DesignStatus>> {
  if (!isUuid(apartmentId)) return new Map();
  const rows = await db.design.findMany({
    where: { room: { apartmentId, apartment: { userId } } },
    orderBy: { version: "desc" },
    select: { roomId: true, status: true },
  });
  const out = new Map<string, DesignStatus>();
  for (const r of rows) if (!out.has(r.roomId)) out.set(r.roomId, DesignStatus.parse(r.status));
  return out;
}

export async function linkCallsToDesign(callIds: readonly string[], designId: string): Promise<void> {
  if (callIds.length === 0) return;
  await db.llmCall.updateMany({ where: { id: { in: [...callIds] } }, data: { designId } });
}
