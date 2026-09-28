import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PUBLIC = join(ROOT, "public");

const UA = { "User-Agent": "raumplan-asset-fetch" };

export async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers: { ...UA, ...headers } });
  if (!res.ok) throw new Error(`${res.status} ${redact(url)}`);
  return (await res.json()) as T;
}

export async function getBytes(url: string, headers: Record<string, string> = {}): Promise<Buffer> {
  const res = await fetch(url, { headers: { ...UA, ...headers } });
  if (!res.ok) throw new Error(`${res.status} ${redact(url)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Signed download links carry credentials in the query; keep them out of logs. */
const redact = (url: string) => url.split("?")[0];

export function writeFile(path: string, data: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

/** Zip entries by path, directories left out. */
export function unzip(data: Uint8Array): Record<string, Uint8Array> {
  const files = unzipSync(data);
  return Object.fromEntries(Object.entries(files).filter(([name]) => !name.endsWith("/")));
}

/** The one entry whose file name matches; throws when none or several do. */
export function pickOne(names: readonly string[], pattern: RegExp, what: string): string {
  const hits = names.filter((n) => pattern.test(n.split("/").pop()!));
  if (hits.length === 1) return hits[0]!;
  throw new Error(`${hits.length ? "several" : "no"} ${what} in zip matching ${pattern}: ${(hits.length ? hits : names).join(", ")}`);
}

export const bytesOf = (path: string) => statSync(path).size;
export const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
export const exists = existsSync;

/** Reads a secret from the environment, falling back to .env.local and .env. */
export function secret(name: string): string | undefined {
  for (const file of [".env.local", ".env"]) {
    if (process.env[name]) break;
    try {
      process.loadEnvFile(join(ROOT, file));
    } catch {
      // Missing file: nothing to load.
    }
  }
  return process.env[name] || undefined;
}
