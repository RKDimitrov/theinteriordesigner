import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { designBrief } from "@/domain/design/brief";
import { roomFacts } from "@/domain/design/room-facts";
import { estimateCostEur } from "@/domain/llm/cost";
import { renderTemplate } from "@/domain/prompts/render";
import { validateDesign } from "@/domain/validator";
import { PROMPTS } from "@/prompts";
import { buildDesignContext } from "../context/build";
import { anthropic, designModels } from "../llm/client";
import { buildPrompt, loadPrompt } from "../llm/prompts";
import { logLlmCall } from "../llm/usage";
import { usageFromApi } from "../llm/usage-map";
import { getApartment } from "../repo/apartments";
import { createDesign, getDesign, linkCallsToDesign, type StoredDesign } from "../repo/designs";
import { getProfile } from "../repo/profiles";
import { getRoom } from "../repo/rooms";
import { modelForAttempt } from "./model-choice";
import { MAX_REPAIRS, type ProgressEvent, runDesignLoop, SUBMIT_DESIGN, SUBMIT_DESIGN_TOOL } from "./repair-loop";

export class DesignInputError extends Error {}

type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;

/**
 * Mark the end of the conversation as cacheable, so each repair turn reads the
 * previous design and issues from cache instead of paying full input price.
 */
function cacheConversation(messages: BetaMessageParam[]): BetaMessageParam[] {
  const last = messages.at(-1);
  if (!last || typeof last.content === "string" || last.content.length === 0) return messages;
  const tail = last.content.at(-1)!;
  if (tail.type !== "tool_result" && tail.type !== "text") return messages;
  const blocks = [...last.content.slice(0, -1), { ...tail, cache_control: { type: "ephemeral" as const } }];
  return [...messages.slice(0, -1), { ...last, content: blocks }];
}

/** Only report streaming progress every this many characters of tool input. */
const PROGRESS_EVERY_CHARS = 1500;

/**
 * Generate, validate and repair a design for one room, then save it as the
 * room's next version (also when still invalid, flagged as such).
 */
export async function generateDesign(args: {
  userId: string;
  apartmentId: string;
  roomId: string;
  onProgress: (e: ProgressEvent) => void;
}): Promise<StoredDesign> {
  const { userId, apartmentId, roomId } = args;
  const [apartment, room, profile] = await Promise.all([getApartment(userId, apartmentId), getRoom(userId, roomId), getProfile(userId, apartmentId)]);
  if (!apartment || !room || room.apartmentId !== apartment.id) throw new DesignInputError("Room not found");
  const ctx = await buildDesignContext(userId, apartmentId);
  if (!ctx) throw new DesignInputError("Apartment not found");

  const facts = roomFacts(room, apartment.northAngleDeg);
  const brief = designBrief(room.id, ctx, profile);
  const def = PROMPTS.designGenerate;
  const prompt = await buildPrompt(def, { roomFacts: JSON.stringify(facts, null, 1), brief: JSON.stringify(brief, null, 1) });
  const repairTemplate = (await loadPrompt(PROMPTS.designRepair)).user;
  const mustKeep = (profile?.mustKeep ?? []).filter((m) => m.roomId === room.id);
  const previous = await getDesign(userId, roomId);

  const client = anthropic();
  const models = designModels();
  const callIds: string[] = [];
  let cost = 0;
  let durationMs = 0;
  let turnStarted = 0;
  let lastModel: string = models.base;

  const result = await runDesignLoop(prompt.user, {
    turn: async (messages, attempt, onChars) => {
      turnStarted = Date.now();
      let chars = 0;
      let reported = 0;
      const stream = client.beta.messages
        .stream({
          model: modelForAttempt(attempt, MAX_REPAIRS, models),
          max_tokens: 64000,
          system: [{ type: "text", text: prompt.system, cache_control: { type: "ephemeral" } }],
          tools: [SUBMIT_DESIGN_TOOL],
          tool_choice: { type: "tool", name: SUBMIT_DESIGN },
          output_config: { effort: models.effort },
          // Server-side refusal fallback: a declined request is retried on a fallback model in the same call.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          messages: cacheConversation(messages),
        })
        .on("inputJson", (delta) => {
          chars += delta.length;
          if (chars - reported >= PROGRESS_EVERY_CHARS) {
            reported = chars;
            onChars(chars);
          }
        });
      return stream.finalMessage();
    },
    validate: (design) => validateDesign({ room, design, mustKeep, budgetEur: profile?.budgetPerRoom[room.id] ?? null, renter: ctx.renter }),
    repairMessage: (issues, attempt) => renderTemplate(repairTemplate, { issues, attempt: String(attempt), maxAttempts: String(MAX_REPAIRS) }),
    onProgress: args.onProgress,
    onTurn: async (res, attempt) => {
      const usage = usageFromApi(res.usage);
      const ms = Date.now() - turnStarted;
      durationMs += ms;
      lastModel = res.model;
      cost += estimateCostEur(res.model, usage);
      const id = await logLlmCall({
        userId,
        apartmentId,
        purpose: attempt === 0 ? "design" : "repair",
        model: res.model,
        prompt: attempt === 0 ? def : PROMPTS.designRepair,
        usage,
        durationMs: ms,
        error: res.stop_reason === "refusal" ? "refusal" : undefined,
      });
      if (id) callIds.push(id);
    },
  });

  const saved = await createDesign(userId, roomId, {
    content: result.content,
    validation: { status: result.status, issues: result.issues, repairAttempts: result.repairAttempts },
    source: { model: lastModel, promptId: def.id, promptVersion: def.version },
    costEstimateEur: Math.round(cost * 10_000) / 10_000,
    durationMs,
    parentVersion: previous?.version ?? null,
  });
  if (!saved) throw new DesignInputError("Room not found");
  await linkCallsToDesign(callIds, saved.id);
  return saved;
}
