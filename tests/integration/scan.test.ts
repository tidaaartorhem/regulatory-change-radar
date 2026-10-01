import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { loadStore, type IngestInput } from "@/lib/ingest/store";
import { ExtractiveSummarizer } from "@/lib/summarize/extractive";
import { runScan } from "@/lib/scan";
import type { Control, RegulatorSource } from "@/lib/types";

const DATA = join(process.cwd(), "data");

function seedInputs(): IngestInput[] {
  const sources = JSON.parse(
    readFileSync(join(DATA, "sources.json"), "utf8"),
  ) as RegulatorSource[];
  const byId = new Map(sources.map((s) => [s.id, s]));
  // Inline fixtures (real publication shapes, synthetic text) — the seed
  // file was removed when ingestion went fully live.
  const fixtures = [
    {
      sourceId: "nydfs",
      title: "NYDFS adopts amendments to 23 NYCRR Part 500 cybersecurity regulation",
      link: "https://www.dfs.ny.gov/example-amendment",
      publishedAt: "2023-11-01T00:00:00Z",
      text: "Covered entities must notify the superintendent within 72 hours of a cybersecurity event. The amendment adds requirements for privileged access management and endpoint detection.",
    },
    {
      sourceId: "osfi",
      title: "OSFI releases revised Guideline B-13 on Technology and Cyber Risk",
      link: "https://www.osfi-bsif.gc.ca/example-b13",
      publishedAt: "2024-01-15T00:00:00Z",
      text: "Federally regulated entities should report technology incidents promptly and maintain tested recovery plans for critical systems.",
    },
  ];
  return fixtures.map((s) => {
    const source = byId.get(s.sourceId)!;
    return {
      sourceId: s.sourceId,
      title: s.title,
      link: s.link,
      publishedAt: s.publishedAt,
      text: s.text,
      jurisdiction: source.jurisdiction,
      sectors: source.sectors,
    };
  });
}

function controls(): Control[] {
  return JSON.parse(readFileSync(join(DATA, "controls.seed.json"), "utf8"));
}

describe("scan pipeline", () => {
  it("produces publications, validated mappings, and briefings end to end", async () => {
    const store = loadStore("/nonexistent/scan-test.json");
    const all = controls();
    const report = await runScan(store, seedInputs(), new ExtractiveSummarizer(), all);

    expect(report.added).toBe(2);
    expect(store.publications).toHaveLength(2);
    expect(store.briefings).toHaveLength(2);

    // Every mapped control ID must exist in the closed taxonomy.
    const validIds = new Set(all.map((c) => c.id));
    for (const m of store.mappings) {
      expect(validIds.has(m.controlId)).toBe(true);
    }
    // Every briefing's affected controls must match its mappings.
    for (const b of store.briefings) {
      const mapped = store.mappings
        .filter((m) => m.publicationId === b.publicationId)
        .map((m) => m.controlId)
        .sort();
      expect([...b.affectedControls].sort()).toEqual(mapped);
    }
    // Every briefing carries an ordered, trackable action plan.
    for (const b of store.briefings) {
      expect(b.actionPlan.length).toBeGreaterThan(0);
      expect(b.actionPlan.map((s) => s.order)).toEqual(
        b.actionPlan.map((_, i) => i + 1),
      );
      expect(b.actionPlan.every((s) => s.done === false)).toBe(true);
    }
  });

  it("is idempotent: re-scanning the same inputs adds nothing", async () => {
    const store = loadStore("/nonexistent/scan-test.json");
    const all = controls();
    const inputs = seedInputs();
    await runScan(store, inputs, new ExtractiveSummarizer(), all);
    const second = await runScan(store, inputs, new ExtractiveSummarizer(), all);
    expect(second.added).toBe(0);
    expect(second.skipped).toBe(2);
    expect(store.publications).toHaveLength(2);
    expect(store.briefings).toHaveLength(2);
  });

  it("never fires the LLM gate with the deterministic extractive summarizer", async () => {
    const store = loadStore("/nonexistent/scan-test.json");
    await runScan(store, seedInputs(), new ExtractiveSummarizer(), controls());
    expect(store.briefings.every((b) => b.llmUsed === false)).toBe(true);
    expect(store.mappings.every((m) => m.method === "taxonomy")).toBe(true);
  });
});
