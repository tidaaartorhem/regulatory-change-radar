import { describe, expect, it } from "vitest";
import { buildActionPlan } from "@/lib/brief/briefing";
import type {
  Control,
  ControlMapping,
  Publication,
  Severity,
} from "@/lib/types";

function pub(overrides: Partial<Publication> = {}): Publication {
  return {
    id: "osfi-xyz",
    sourceId: "osfi",
    title: "OSFI releases revised Guideline B-13 on Technology and Cyber Risk",
    url: "https://example.com/b13",
    publishedAt: "2024-01-01T00:00:00Z",
    rawText: "Federally regulated entities must report technology incidents within 72 hours.",
    contentHash: "x",
    jurisdiction: "CA",
    sectors: ["banking", "cyber"],
    ingestedAt: "2024-01-02T00:00:00Z",
    ...overrides,
  };
}

function control(overrides: Partial<Control> = {}): Control {
  return {
    id: "OSFI-B13-3.1",
    framework: "OSFI Guideline B-13",
    title: "Incident reporting",
    description: "Report technology and cyber incidents to OSFI promptly.",
    sectors: ["banking", "cyber"],
    keywords: ["incident", "report", "72 hours"],
    ...overrides,
  };
}

function mapping(controlId: string, score: number): ControlMapping {
  return {
    publicationId: "osfi-xyz",
    controlId,
    score,
    matchedKeywords: ["incident", "72 hours"],
    method: "taxonomy",
  };
}

const GEN_AT = "2026-10-01T12:00:00Z";

describe("buildActionPlan", () => {
  it("is deterministic — same inputs always yield the same plan", () => {
    const controls = [control()];
    const mappings = [mapping("OSFI-B13-3.1", 0.9)];
    const a = buildActionPlan(pub(), "high", mappings, controls, GEN_AT);
    const b = buildActionPlan(pub(), "high", mappings, controls, GEN_AT);
    expect(a).toEqual(b);
  });

  it("orders Assess → Remediate → Verify with sequential step numbers", () => {
    const controls = [control(), control({ id: "OSFI-B13-3.2", title: "Recovery" })];
    const plan = buildActionPlan(
      pub(),
      "high",
      [mapping("OSFI-B13-3.1", 0.7), mapping("OSFI-B13-3.2", 0.95)],
      controls,
      GEN_AT,
    );
    expect(plan.map((s) => s.phase)).toEqual([
      "Assess",
      "Remediate",
      "Remediate",
      "Verify",
      "Verify",
    ]);
    expect(plan.map((s) => s.order)).toEqual([1, 2, 3, 4, 5]);
    // Remediate steps follow mapping score order (highest first).
    expect(plan[1].title).toContain("OSFI-B13-3.2");
    expect(plan[2].title).toContain("OSFI-B13-3.1");
  });

  it("caps remediation steps at 5 controls", () => {
    const controls = Array.from({ length: 8 }, (_, i) =>
      control({ id: `OSFI-B13-3.${i}` }),
    );
    const mappings = controls.map((c, i) => mapping(c.id, 0.9 - i * 0.01));
    const plan = buildActionPlan(pub(), "medium", mappings, controls, GEN_AT);
    expect(plan.filter((s) => s.phase === "Remediate")).toHaveLength(5);
  });

  it("assigns owners from the framework rules and gives every step evidence + a due date", () => {
    const plan = buildActionPlan(
      pub(),
      "critical",
      [mapping("OSFI-B13-3.1", 0.9)],
      [control()],
      GEN_AT,
    );
    for (const s of plan) {
      expect(s.owner.length).toBeGreaterThan(0);
      expect(s.evidence.length).toBeGreaterThan(0);
      expect(s.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.done).toBe(false);
    }
    expect(plan.find((s) => s.phase === "Remediate")?.owner).toBe(
      "Technology Risk Officer",
    );
    const ids = plan.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("scales due dates by severity — critical sooner than low", () => {
    const controls = [control()];
    const mappings = [mapping("OSFI-B13-3.1", 0.9)];
    const crit = buildActionPlan(pub(), "critical", mappings, controls, GEN_AT);
    const low = buildActionPlan(pub(), "low", mappings, controls, GEN_AT);
    const critRemediate = crit.find((s) => s.phase === "Remediate")!.dueDate;
    const lowRemediate = low.find((s) => s.phase === "Remediate")!.dueDate;
    expect(critRemediate < lowRemediate).toBe(true);
  });

  it("grounds every step in the source text or the control library — nothing invented", () => {
    const p = pub();
    const c = control();
    const plan = buildActionPlan(p, "high", [mapping(c.id, 0.9)], [c], GEN_AT);
    const vocabulary = [
      p.title,
      "Canadian",
      ...p.sectors,
      c.id,
      c.title,
      c.description,
      c.framework,
      "incident",
      "72 hours",
    ]
      .join(" ")
      .toLowerCase();
    for (const s of plan) {
      const text = `${s.title} ${s.detail} ${s.evidence}`.toLowerCase();
      // At least one grounded phrase must appear in every step's text.
      const grounded = ["osfi", "guideline b-13", "technology", "cyber", "incident", "72 hours", "canadian", "banking", "report"]
        .some((phrase) => text.includes(phrase) && vocabulary.includes(phrase));
      expect(grounded, `step not grounded: ${s.title}`).toBe(true);
    }
  });

  it("produces a valid plan even when no controls mapped", () => {
    const plan = buildActionPlan(pub(), "medium", [], [], GEN_AT);
    expect(plan.map((s) => s.phase)).toEqual(["Assess", "Verify", "Verify"]);
    expect(plan.every((s) => s.owner.length > 0)).toBe(true);
  });
});
