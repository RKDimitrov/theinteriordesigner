import { z } from "zod";

/** Server-sent events of POST /api/design/generate. Parsed with Zod on the client. */
export const DesignEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    /** context → designing → placing → checking → fixing (patch round) → done. The v1 stage names are kept for old clients. */
    stage: z.enum(["context", "designing", "placing", "checking", "fixing", "generating", "writing", "validating", "repairing"]),
    attempt: z.number().int(),
    maxAttempts: z.number().int().optional(),
    chars: z.number().int().optional(),
    errors: z.number().int().optional(),
    warnings: z.number().int().optional(),
  }),
  z.object({ type: z.literal("done"), version: z.number().int(), status: z.enum(["valid", "valid_with_warnings", "invalid"]) }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type DesignEvent = z.infer<typeof DesignEvent>;

export const GenerateRequest = z.object({
  apartmentId: z.uuid(),
  roomId: z.uuid(),
  /** "Ask for a change" from the planner, passed to the model in the brief. */
  note: z.string().trim().max(400).optional(),
  /** Ask the model to keep the pieces the user placed by hand. */
  keepPlaced: z.boolean().optional(),
});

export function encodeEvent(e: DesignEvent): string {
  return `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
}

/** Split an SSE buffer into complete events; returns the parsed events and the unconsumed rest. */
export function parseEvents(buffer: string): { events: DesignEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: DesignEvent[] = [];
  for (const part of parts) {
    const data = part
      .split("\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => l.slice(6))
      .join("\n");
    if (!data) continue;
    try {
      const parsed = DesignEvent.safeParse(JSON.parse(data));
      if (parsed.success) events.push(parsed.data);
    } catch {
      // Ignore malformed chunks; the stream continues.
    }
  }
  return { events, rest };
}
