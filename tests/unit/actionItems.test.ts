import { describe, expect, it } from "vitest";
import {
  aggregateActionItems,
  dueLabel,
} from "@/lib/actionItems";
import type {
  ActionPlanStep,
  Briefing,
  Publication,
} from "@/lib/types";

const NOW = new Date("2026-10-01T12:00:00Z").getTime();

function step(
  id: string,
  phase: "Assess" | "Remediate" | "Verify",
  dueDate: string,
  done = false,
): ActionPlanStep {
  return {
    id,
    order: 1,
    phase,
    title: `Step ${id}`,
    detail: "detail",
    owner: "Owner",
    dueDate,
    evidence: "evidence",
    done,
  };
}

function pub(id: string): Publication {
  return {
    id,
    sourceId: "sec",
    title: `Publication ${id}`,
    url: "https://example.com",
    publishedAt: "2026-09-20",
    rawText: "text",
    contentHash: "hash",
    jurisdiction: "US",
    sectors: ["banking"],
    ingestedAt: "2026-10-01T00:00:00Z",
  };
}

function briefing(
  publicationId: string,
  severity: "critical" | "high" | "medium" | "low",
  steps: ActionPlanStep[],
): Briefing {
  return {
    publicationId,
    whatChanged: [],
    affectedControls: [],
    severity,
    severityReasons: [],
    suggestedActions: [],
    actionPlan: steps,
    generatedAt: "2026-09-20T00:00:00Z",
    llmUsed: false,
  };
}

describe("aggregateActionItems", () => {
  it("aggregates counts by phase and completion status", () => {
    const summary = aggregateActionItems(
      [pub("p1")],
      [
        briefing("p1", "high", [
          step("s1", "Assess", "2026-10-05", true),
          step("s2", "Remediate", "2026-10-20"),
          step("s3", "Verify", "2026-11-01"),
        ]),
      ],
      NOW,
    );
    expect(summary.total).toBe(3);
    expect(summary.done).toBe(1);
    expect(summary.open).toBe(2);
    expect(summary.pct).toBe(33);
    expect(summary.byPhase).toEqual([
      { phase: "Assess", total: 1, done: 1 },
      { phase: "Remediate", total: 1, done: 0 },
      { phase: "Verify", total: 1, done: 0 },
    ]);
  });

  it("flags overdue and due-soon items from severity SLA due dates", () => {
    const summary = aggregateActionItems(
      [pub("p1")],
      [
        briefing("p1", "critical", [
          step("past", "Remediate", "2026-09-25"), // overdue
          step("soon", "Assess", "2026-10-03"), // due in 2d
          step("later", "Verify", "2026-12-01"), // far out
          step("done-past", "Assess", "2026-09-01", true), // done: not urgent
        ]),
      ],
      NOW,
    );
    expect(summary.overdue.map((i) => i.step.id)).toEqual(["past"]);
    expect(summary.dueSoon.map((i) => i.step.id)).toEqual(["soon"]);
  });

  it("sorts urgent items by severity then due date, capped at 8", () => {
    const steps = [
      step("low-early", "Remediate", "2026-10-02"),
      step("crit-late", "Remediate", "2026-10-30"),
      step("crit-early", "Assess", "2026-10-02"),
      step("high-mid", "Verify", "2026-10-10"),
    ];
    const summary = aggregateActionItems(
      [pub("p1"), pub("p2"), pub("p3"), pub("p4")],
      [
        briefing("p1", "low", [steps[0]]),
        briefing("p2", "critical", [steps[1]]),
        briefing("p3", "critical", [steps[2]]),
        briefing("p4", "high", [steps[3]]),
      ],
      NOW,
    );
    expect(summary.urgent.map((i) => i.step.id)).toEqual([
      "crit-early",
      "crit-late",
      "high-mid",
      "low-early",
    ]);
  });

  it("handles an empty dataset", () => {
    const summary = aggregateActionItems([], [], NOW);
    expect(summary.total).toBe(0);
    expect(summary.pct).toBe(0);
    expect(summary.urgent).toEqual([]);
  });

  it("dueLabel renders relative labels", () => {
    const summary = aggregateActionItems([], [], NOW);
    expect(dueLabel(summary.daysUntil, "2026-09-28")).toBe("overdue 3d");
    expect(dueLabel(summary.daysUntil, "2026-10-01")).toBe("due today");
    expect(dueLabel(summary.daysUntil, "2026-10-06")).toBe("due in 5d");
  });
});
