import { describe, expect, it } from "vitest";
import { classifyWithLlmGate } from "@/lib/map/llmGate";
import type { Control } from "@/lib/types";
import type { Summarizer, Summary } from "@/lib/summarize/adapter";

const CANDIDATES: Control[] = [
  { id: "NYDFS-500.16", framework: "NYDFS", title: "Event notification", description: "", sectors: ["banking"], keywords: [] },
  { id: "OSFI-B13-5", framework: "OSFI", title: "Incident reporting", description: "", sectors: ["banking"], keywords: [] },
];

const nonLlmAdapter: Summarizer = {
  name: "demo",
  usesLlm: false,
  summarize: (): Summary => ({ whatChanged: [], keyPhrases: [], documentKind: "notice" }),
};

const llmAdapter: Summarizer = {
  ...nonLlmAdapter,
  name: "fake-llm",
  usesLlm: true,
};

describe("classifyWithLlmGate", () => {
  it("stays shut when the adapter is not LLM-backed", async () => {
    const out = await classifyWithLlmGate("p1", "text", CANDIDATES, nonLlmAdapter, async () => "[]");
    expect(out).toEqual([]);
  });

  it("accepts valid control IDs from the closed taxonomy", async () => {
    const out = await classifyWithLlmGate(
      "p1",
      "text",
      CANDIDATES,
      llmAdapter,
      async () => JSON.stringify([{ controlId: "NYDFS-500.16", score: 0.9 }]),
    );
    expect(out).toHaveLength(1);
    expect(out[0].controlId).toBe("NYDFS-500.16");
    expect(out[0].score).toBe(0.9);
    expect(out[0].method).toBe("llm-gate");
  });

  it("drops hallucinated control IDs — the leash", async () => {
    const out = await classifyWithLlmGate(
      "p1",
      "text",
      CANDIDATES,
      llmAdapter,
      async () =>
        JSON.stringify([
          { controlId: "NYDFS-500.16", score: 0.8 },
          { controlId: "MADE-UP-999", score: 0.99 },
        ]),
    );
    expect(out.map((m) => m.controlId)).toEqual(["NYDFS-500.16"]);
  });

  it("clamps scores into [0, 1]", async () => {
    const out = await classifyWithLlmGate(
      "p1",
      "text",
      CANDIDATES,
      llmAdapter,
      async () => JSON.stringify([{ controlId: "OSFI-B13-5", score: 42 }]),
    );
    expect(out[0].score).toBe(1);
  });

  it("handles fenced JSON responses", async () => {
    const out = await classifyWithLlmGate(
      "p1",
      "text",
      CANDIDATES,
      llmAdapter,
      async () => '```json\n[{"controlId": "OSFI-B13-5", "score": 0.7}]\n```',
    );
    expect(out).toHaveLength(1);
  });

  it("returns [] on malformed output or generator failure", async () => {
    const bad = await classifyWithLlmGate("p1", "text", CANDIDATES, llmAdapter, async () => "not json");
    expect(bad).toEqual([]);
    const failed = await classifyWithLlmGate("p1", "text", CANDIDATES, llmAdapter, async () => {
      throw new Error("boom");
    });
    expect(failed).toEqual([]);
  });
});
