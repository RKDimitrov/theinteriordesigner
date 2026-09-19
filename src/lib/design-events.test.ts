import { describe, expect, it } from "vitest";
import { encodeEvent, GenerateRequest, parseEvents } from "./design-events";

describe("design SSE events", () => {
  it("round-trips events across chunk boundaries", () => {
    const text = encodeEvent({ type: "progress", stage: "generating", attempt: 0, maxAttempts: 4 }) + encodeEvent({ type: "done", version: 3, status: "valid" });
    const first = parseEvents(text.slice(0, 30));
    expect(first.events).toEqual([]);
    const second = parseEvents(first.rest + text.slice(30));
    expect(second.events.map((e) => e.type)).toEqual(["progress", "done"]);
    expect(second.rest).toBe("");
  });

  it("drops malformed events", () => {
    expect(parseEvents("data: {nope\n\ndata: {\"type\":\"x\"}\n\n").events).toEqual([]);
  });

  it("validates the request body", () => {
    expect(GenerateRequest.safeParse({ apartmentId: "x", roomId: "y" }).success).toBe(false);
    expect(GenerateRequest.safeParse({ apartmentId: "0b6f1a52-8a55-4c55-9f5e-2f4d7a0b8c11", roomId: "0b6f1a52-8a55-4c55-9f5e-2f4d7a0b8c12" }).success).toBe(true);
  });
});
