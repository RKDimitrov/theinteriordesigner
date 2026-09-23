/**
 * Registry of versioned prompt files in this folder. A file holds the system
 * prompt, a line `---user---`, then the user template with `{{placeholders}}`.
 * Bump the version (new file) instead of editing a prompt in place, so logged
 * calls stay traceable.
 */
export const PROMPTS = {
  trendsResearch: { id: "trends-research", version: "v1", file: "trends-research.v1.md" },
  designGenerate: { id: "design-generate", version: "v1", file: "design-generate.v1.md" },
  /** User-only template (empty system part), sent as the error tool_result. */
  designRepair: { id: "design-repair", version: "v1", file: "design-repair.v1.md" },
  /** Model returns intents (DesignPlanInput); the app places pieces. System part embeds {{catalogue}}. */
  designGenerateV2: { id: "design-generate", version: "v2", file: "design-generate.v2.md" },
  /** User-only template: asks for a small DesignPatch instead of a whole new design. */
  designRepairV2: { id: "design-repair", version: "v2", file: "design-repair.v2.md" },
} as const;

export type PromptDef = (typeof PROMPTS)[keyof typeof PROMPTS];

export const USER_SEPARATOR = "---user---";
