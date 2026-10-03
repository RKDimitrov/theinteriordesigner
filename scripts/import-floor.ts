/**
 * Enters a whole floor into an account, from a floor description
 * (see src/domain/room/floor.ts and scripts/floors/*.json).
 *
 *   npx -y tsx scripts/import-floor.ts <floor.json> --preview <out.svg>   draw it, write nothing
 *   npx -y tsx scripts/import-floor.ts <floor.json> --email <user email>  create or replace it in that account
 *   … --name "<apartment name>"                                          use another name (a separate copy)
 *
 * The apartment is matched by name for that user: running it again replaces
 * its rooms (and their designs) instead of adding a second copy. No furniture
 * is added. Uses DATABASE_URL from .env.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import { area } from "../src/domain/geometry/polygon";
import { wallsOf } from "../src/domain/geometry/walls";
import { openingSpan } from "../src/domain/geometry/openings";
import { RoomInput } from "../src/domain/room/check-room";
import { Floor, floorRooms, type FloorResult } from "../src/domain/room/floor";
import { slopeBands } from "../src/domain/room/roof";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env: DATABASE_URL must come from the environment.
}

const args = process.argv.slice(2);
const value = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const file = args.find((a) => a.endsWith(".json"));
if (!file) throw new Error("usage: import-floor.ts <floor.json> (--preview <out.svg> | --email <email>)");

const parsed = Floor.parse(JSON.parse(readFileSync(file, "utf8")));
const rename = value("--name");
const floor = rename ? { ...parsed, apartment: { ...parsed.apartment, name: rename } } : parsed;
const rooms = floorRooms(floor);
for (const r of rooms) {
  const checked = RoomInput.safeParse(r.shape);
  if (!checked.success) throw new Error(`${r.shape.name}: ${checked.error.issues.map((i) => i.message).join("; ")}`);
}

const preview = value("--preview");
const email = value("--email");
if (preview) writeFileSync(preview, drawing(rooms));
if (email) void importFloor(email).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
if (!preview && !email) console.log(`${rooms.length} rooms, valid. Pass --preview or --email.`);

/** A labelled drawing for checking the floor before it goes into an account. */
function drawing(list: readonly FloorResult[]): string {
  const W = 12;
  const pad = 120;
  const pts = list.flatMap((r) => r.shape.polygon.map((p) => ({ x: p.x + r.origin.x, y: p.y + r.origin.y })));
  const maxX = Math.max(...pts.map((p) => p.x)) + W;
  const maxY = Math.max(...pts.map((p) => p.y)) + W;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${maxX + 2 * pad} ${maxY + 2 * pad}" width="${Math.round((maxX + 2 * pad) * 1.3)}" height="${Math.round((maxY + 2 * pad) * 1.3)}" font-family="monospace">`);
  out.push(`<rect x="${-pad}" y="${-pad}" width="${maxX + 2 * pad}" height="${maxY + 2 * pad}" fill="#fbf6ec"/>`);
  for (const r of list) {
    const o = r.origin;
    const at = (p: { x: number; y: number }) => `${(p.x + o.x).toFixed(1)},${(p.y + o.y).toFixed(1)}`;
    const walls = wallsOf(r.shape.polygon);
    out.push(`<polygon points="${r.shape.polygon.map(at).join(" ")}" fill="#f3e7d0" stroke="#2b2622" stroke-width="${W}" stroke-linejoin="miter" paint-order="stroke"/>`);
    for (const b of slopeBands(r.shape)) {
      out.push(`<polygon points="${b.polygon.map(at).join(" ")}" fill="#d9c7a7" opacity="0.6"/>`);
      out.push(`<line x1="${b.line[0].x + o.x}" y1="${b.line[0].y + o.y}" x2="${b.line[1].x + o.x}" y2="${b.line[1].y + o.y}" stroke="#2b2622" stroke-width="2" stroke-dasharray="10 7"/>`);
    }
    for (const op of r.shape.openings) {
      const span = openingSpan(walls, op);
      if (!span) continue;
      const colour = op.kind === "window" ? "#4a90c2" : op.kind === "door" && op.swing === "none" ? "#fbf6ec" : "#c8794a";
      out.push(`<line x1="${span.start.x + o.x}" y1="${span.start.y + o.y}" x2="${span.end.x + o.x}" y2="${span.end.y + o.y}" stroke="${colour}" stroke-width="${W + 2}"/>`);
      const mid = { x: (span.start.x + span.end.x) / 2 + o.x + span.wall.inward.x * 22, y: (span.start.y + span.end.y) / 2 + o.y + span.wall.inward.y * 22 };
      const what = op.kind === "window" ? `window ${op.width}` : op.kind === "door" && op.swing === "none" ? `open ${op.width}` : `door ${op.width}`;
      out.push(`<text x="${mid.x}" y="${mid.y}" font-size="14" text-anchor="middle" dominant-baseline="central" fill="#2b2622">${what}</text>`);
    }
    for (const f of r.shape.fixedElements) {
      out.push(`<rect x="${f.rect.x + o.x}" y="${f.rect.y + o.y}" width="${f.rect.w}" height="${f.rect.d}" fill="#bfae92" stroke="#2b2622" stroke-width="1.5"/>`);
    }
    for (const w of walls) {
      const mid = { x: (w.a.x + w.b.x) / 2 + o.x + w.inward.x * 48, y: (w.a.y + w.b.y) / 2 + o.y + w.inward.y * 48 };
      out.push(`<text x="${mid.x}" y="${mid.y}" font-size="15" text-anchor="middle" dominant-baseline="central" fill="#6b5b4a">${Math.round(w.length)}</text>`);
    }
    const cx = r.shape.polygon.reduce((n, p) => n + p.x, 0) / r.shape.polygon.length + o.x;
    const cy = r.shape.polygon.reduce((n, p) => n + p.y, 0) / r.shape.polygon.length + o.y;
    out.push(`<text x="${cx}" y="${cy - 12}" font-size="22" font-weight="bold" text-anchor="middle" fill="#2b2622">${r.shape.name}</text>`);
    out.push(`<text x="${cx}" y="${cy + 14}" font-size="15" text-anchor="middle" fill="#2b2622">${(area(r.shape.polygon) / 10_000).toFixed(1)} m² · ${r.shape.ceilingHeight} cm</text>`);
  }
  out.push(`<text x="${-pad + 20}" y="${-pad + 40}" font-size="20" fill="#2b2622">Blue: windows · orange: doors · light gap: open passage · hatched with dashed line: roof slope (170 at the wall)</text>`);
  out.push("</svg>");
  return out.join("\n");
}

async function importFloor(userEmail: string) {
  const client = new pg.Client({ connectionString: process.env["DATABASE_URL"] });
  await client.connect();
  try {
    const user = await client.query<{ id: string }>("select id from auth.users where lower(email) = lower($1)", [userEmail]);
    const userId = user.rows[0]?.id;
    if (!userId) throw new Error(`no account with email ${userEmail}`);
    const a = floor.apartment;
    const totalAreaM2 = Math.round(rooms.reduce((n, r) => n + area(r.shape.polygon), 0) / 1000) / 10;
    await client.query("begin");
    const existing = await client.query<{ id: string }>(`select id from "Apartment" where "userId" = $1 and name = $2`, [userId, a.name]);
    let apartmentId = existing.rows[0]?.id;
    if (apartmentId) {
      await client.query(`delete from "Room" where "apartmentId" = $1`, [apartmentId]);
      await client.query(`update "Apartment" set address = $2, city = $3, country = $4, "floorLevel" = $5, tenure = $6, "totalAreaM2" = $7, "northAngleDeg" = $8, "updatedAt" = now() where id = $1`, [apartmentId, a.address, a.city, a.country, a.floorLevel, a.tenure, totalAreaM2, a.northAngleDeg]);
    } else {
      apartmentId = randomUUID();
      await client.query(`insert into "Apartment" (id, "userId", name, address, city, country, "floorLevel", tenure, "totalAreaM2", "northAngleDeg", "updatedAt") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`, [apartmentId, userId, a.name, a.address, a.city, a.country, a.floorLevel, a.tenure, totalAreaM2, a.northAngleDeg]);
    }
    for (const [i, r] of rooms.entries()) {
      const s = RoomInput.parse(r.shape);
      await client.query(
        `insert into "Room" (id, "apartmentId", name, type, polygon, "ceilingHeight", openings, "fixedElements", "wallOrientationOverrides", "roofSlopes", "planX", "planY", "sortOrder", "updatedAt") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())`,
        [randomUUID(), apartmentId, s.name, s.type, JSON.stringify(s.polygon), s.ceilingHeight, JSON.stringify(s.openings), JSON.stringify(s.fixedElements), JSON.stringify(s.wallOrientationOverrides), JSON.stringify(s.roofSlopes), r.origin.x, r.origin.y, i],
      );
    }
    await client.query("commit");
    console.log(`${existing.rows[0] ? "replaced" : "created"} "${a.name}" (${apartmentId}) with ${rooms.length} rooms, ${totalAreaM2} m², for ${userEmail}`);
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    await client.end();
  }
}
