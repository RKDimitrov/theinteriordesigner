import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderTemplate } from "@/domain/prompts/render";
import { type PromptDef, USER_SEPARATOR } from "@/prompts";

const cache = new Map<string, { system: string; user: string }>();

/** Raw system text and user template of a prompt file (cached). */
export async function loadPrompt(def: PromptDef): Promise<{ system: string; user: string }> {
  const hit = cache.get(def.file);
  if (hit) return hit;
  const raw = await readFile(path.join(process.cwd(), "src", "prompts", def.file), "utf8");
  const [system, user] = raw.split(USER_SEPARATOR);
  if (system === undefined || user === undefined) throw new Error(`Prompt ${def.file} has no ${USER_SEPARATOR} line`);
  const parts = { system: system.trim(), user: user.trim() };
  cache.set(def.file, parts);
  return parts;
}

/** System prompt (static, cacheable) and rendered user message for a prompt. */
export async function buildPrompt(def: PromptDef, vars: Readonly<Record<string, string>>): Promise<{ system: string; user: string }> {
  const p = await loadPrompt(def);
  return { system: p.system, user: renderTemplate(p.user, vars) };
}
