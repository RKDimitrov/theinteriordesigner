import "server-only";
import { z } from "zod";

const ServerEnv = z.object({
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Model used for design generation and repairs. */
  DESIGN_MODEL: z.string().default("claude-sonnet-5"),
  /** Model used for the last repair when the design is still invalid. */
  DESIGN_ESCALATE_MODEL: z.string().default("claude-opus-5"),
  /** Thinking depth: low is the cheapest that still reasons about the layout. */
  DESIGN_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("low"),
});

export const serverEnv = ServerEnv.parse(process.env);
