import "server-only";
import { z } from "zod";

const ServerEnv = z.object({
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export const serverEnv = ServerEnv.parse(process.env);
