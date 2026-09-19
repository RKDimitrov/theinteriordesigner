/**
 * Registry of versioned prompt files in this folder. A file holds the system
 * prompt, a line `---user---`, then the user template with `{{placeholders}}`.
 * Bump the version (new file) instead of editing a prompt in place, so logged
 * calls stay traceable.
 */
export const PROMPTS = {
  trendsResearch: { id: "trends-research", version: "v1", file: "trends-research.v1.md" },
} as const;

export type PromptDef = (typeof PROMPTS)[keyof typeof PROMPTS];

export const USER_SEPARATOR = "---user---";
