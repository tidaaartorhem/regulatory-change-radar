import { describe, expect, it } from "vitest";
import { ExtractiveSummarizer } from "@/lib/summarize/extractive";

const summarizer = new ExtractiveSummarizer();

describe("ExtractiveSummarizer", () => {
  const input = {
    title: "NYDFS amends 23 NYCRR Part 500 cybersecurity regulation",
    text: "The New York Department of Financial Services has adopted amendments to its cybersecurity regulation. Covered entities must notify the superintendent within 72 hours of a cybersecurity event. The amendments are effective November 1, 2024. This update introduces new governance requirements for large companies.",
  };

  it("is deterministic", () => {
    expect(summarizer.summarize(input)).toEqual(summarizer.summarize(input));
  });

  it("extracts deadline and date key phrases", () => {
    const s = summarizer.summarize(input);
    expect(s.keyPhrases.join(" ").toLowerCase()).toContain("72 hours");
  });

  it("ranks signal-bearing sentences first", () => {
    const s = summarizer.summarize(input);
    expect(s.whatChanged.length).toBeGreaterThan(0);
    expect(s.whatChanged.length).toBeLessThanOrEqual(3);
    // Every bullet should carry at least one regulatory signal word —
    // the extractor ranks by signal density, not sentence order.
    for (const bullet of s.whatChanged) {
      expect(bullet.toLowerCase()).toMatch(
        /must|amendment|effective|update|new|require|deadline/,
      );
    }
  });

  it("classifies rule documents", () => {
    expect(summarizer.summarize(input).documentKind).toBe("rule");
  });

  it("classifies advisories", () => {
    const s = summarizer.summarize({
      title: "CISA alert",
      text: "This cybersecurity advisory warns of an actively exploited vulnerability. Apply patches immediately to reduce threat exposure.",
    });
    expect(s.documentKind).toBe("advisory");
  });

  it("classifies enforcement actions", () => {
    const s = summarizer.summarize({
      title: "OCC enforcement",
      text: "The agency announced an enforcement action and civil money penalty against the bank for risk management failures.",
    });
    expect(s.documentKind).toBe("enforcement");
  });

  it("falls back to the title when there is no body text", () => {
    const s = summarizer.summarize({ title: "OSFI news release", text: "" });
    expect(s.whatChanged).toEqual(["OSFI news release"]);
  });

  it("never claims LLM usage", () => {
    expect(summarizer.usesLlm).toBe(false);
  });
});
