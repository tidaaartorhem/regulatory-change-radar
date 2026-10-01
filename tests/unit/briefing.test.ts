import { describe, expect, it } from "vitest";
import { generateBriefing } from "@/lib/brief/briefing";
import type { Publication } from "@/lib/types";
import type { Summary } from "@/lib/summarize/adapter";

function pub(overrides: Partial<Publication> = {}): Publication {
  return {
    id: "nydfs-abc123",
    sourceId: "nydfs",
    title: "NYDFS amends Part 500",
    url: "https://example.com",
    publishedAt: "2024-11-01T00:00:00Z",
    rawText: "Covered entities must notify the superintendent within 72 hours of a cybersecurity event.",
    contentHash: "x",
    jurisdiction: "US",
    sectors: ["banking", "cyber"],
    ...overrides,
  };
}

const summary: Summary = {
  whatChanged: ["Entities must notify within 72 hours."],
  keyPhrases: ["within 72 hours"],
  documentKind: "rule",
};

describe("generateBriefing", () => {
  it("rates 72-hour mandatory obligations as critical", () => {
    const b = generateBriefing(pub(), summary, ["NYDFS-500.16"], [], false);
    expect(b.severity).toBe("critical");
    expect(b.severityReasons.length).toBeGreaterThan(0);
  });

  it("rates proposals lower than binding rules", () => {
    const b = generateBriefing(
      pub({
        sourceId: "naic",
        title: "NAIC exposes model law for consultation",
        rawText: "The working group released a draft for public consultation and comment.",
      }),
      { ...summary, documentKind: "notice" },
      [],
      [],
      false,
    );
    expect(["low", "medium"]).toContain(b.severity);
  });

  it("produces owned, deduplicated actions", () => {
    const b = generateBriefing(pub(), summary, ["NYDFS-500.16"], [], false);
    expect(b.suggestedActions.length).toBeGreaterThan(0);
    for (const a of b.suggestedActions) {
      expect(a.action.length).toBeGreaterThan(0);
      expect(a.owner.length).toBeGreaterThan(0);
    }
    const texts = b.suggestedActions.map((a) => a.action);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("records whether the LLM gate fired", () => {
    expect(generateBriefing(pub(), summary, [], [], false).llmUsed).toBe(false);
    expect(generateBriefing(pub(), summary, [], [], true).llmUsed).toBe(true);
  });

  it("carries the extracted change bullets and mapped controls", () => {
    const b = generateBriefing(pub(), summary, ["NYDFS-500.16", "NIST-CSF-RS.CO-02"], [], false);
    expect(b.whatChanged).toEqual(summary.whatChanged);
    expect(b.affectedControls).toEqual(["NYDFS-500.16", "NIST-CSF-RS.CO-02"]);
    expect(b.publicationId).toBe("nydfs-abc123");
  });
});
