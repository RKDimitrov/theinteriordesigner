import Anthropic from "@anthropic-ai/sdk";
import { type DesignEvent, encodeEvent, GenerateRequest } from "@/lib/design-events";
import { getUserId } from "@/server/auth";
import { DesignInputError, generateDesign } from "@/server/design/generate";
import { DesignGenerationError } from "@/server/design/repair-loop";
import { LlmConfigError } from "@/server/llm/client";
import { hitRateLimit, LIMITS } from "@/server/rate-limit";

// Generation with repairs can take several minutes.
export const maxDuration = 600;

const json = (status: number, message: string) => Response.json({ error: message }, { status });

function errorMessage(e: unknown): string {
  if (e instanceof DesignInputError || e instanceof DesignGenerationError || e instanceof LlmConfigError) return e.message;
  if (e instanceof Anthropic.RateLimitError) return "The AI service is busy. Try again in a minute.";
  if (e instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.APIError) return `AI service error (${e.status ?? "network"}). Try again later.`;
  console.error("Design generation failed", e);
  return "Design generation failed unexpectedly.";
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return json(401, "Not signed in");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, "Invalid JSON");
  }
  const parsed = GenerateRequest.safeParse(body);
  if (!parsed.success) return json(400, "Invalid request");

  const limit = await hitRateLimit(userId, "design", LIMITS.design);
  if (!limit.ok) return json(429, `Design limit reached. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (e: DesignEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(e)));
        } catch {
          // Client went away; keep generating so the design is still saved.
          open = false;
        }
      };
      send({ type: "progress", stage: "context", attempt: 0 });
      try {
        const design = await generateDesign({
          userId,
          ...parsed.data,
          onProgress: (p) => send({ type: "progress", ...p }),
        });
        send({ type: "done", version: design.version, status: design.validation.status });
      } catch (e) {
        send({ type: "error", message: errorMessage(e) });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
