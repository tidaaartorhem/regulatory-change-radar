import type {
  ActionPlanPhase,
  ActionPlanStep,
  Briefing,
  Control,
  ControlMapping,
  Publication,
  Severity,
  SuggestedAction,
} from "@/lib/types";
import type { Summary } from "@/lib/summarize/adapter";

interface SeveritySignal {
  pattern: RegExp;
  points: number;
  reason: string;
}

const SIGNALS: SeveritySignal[] = [
  {
    pattern: /72-hour|72 hour|mandatory|enforcement action|ransomware payment/i,
    points: 2,
    reason: "Contains a mandatory short-fuse obligation (e.g. 72-hour rule)",
  },
  {
    pattern: /final rule|amendment|revision|new requirement/i,
    points: 1,
    reason: "Amends or introduces binding requirements",
  },
  {
    pattern: /\bmust\b|\bshall\b|required to|prohibit/i,
    points: 1,
    reason: "Uses obligating language (must/shall/required)",
  },
  {
    pattern: /effective|compliance date|deadline/i,
    points: 1,
    reason: "Names an effective or compliance date",
  },
  {
    pattern: /proposed|consultation|request for comment|draft/i,
    points: -1,
    reason: "Proposal stage — not yet binding",
  },
  {
    pattern: /speech|remarks|blog|op-ed/i,
    points: -1,
    reason: "Informational rather than regulatory action",
  },
];

const HIGH_IMPACT_SOURCES = new Set([
  "nydfs",
  "osfi",
  "sec",
  "occ",
  "fed",
  "fdic",
]);

function classifySeverity(
  pub: Publication,
  summary: Summary,
): { severity: Severity; reasons: string[] } {
  const haystack = `${pub.title} ${pub.rawText}`;
  let points = 1; // baseline: a regulator published something
  const reasons: string[] = [];
  for (const s of SIGNALS) {
    if (s.pattern.test(haystack)) {
      points += s.points;
      reasons.push(s.reason);
    }
  }
  if (HIGH_IMPACT_SOURCES.has(pub.sourceId) && points >= 2) {
    points += 1;
    reasons.push("Issued by a primary prudential/market regulator");
  }
  const severity: Severity =
    points >= 4 ? "critical" : points >= 3 ? "high" : points >= 1 ? "medium" : "low";
  return { severity, reasons: [...new Set(reasons)] };
}

const SECTOR_ACTIONS: Record<string, { action: string; owner: string }[]> = {
  cyber: [
    {
      action: "Validate detective coverage for the mapped controls in the SIEM",
      owner: "SOC Lead",
    },
    {
      action: "Confirm incident playbooks reflect any new notification timelines",
      owner: "CISO",
    },
  ],
  banking: [
    {
      action: "Run a gap assessment of the mapped controls against current policies",
      owner: "Chief Compliance Officer",
    },
    {
      action: "Brief the board risk committee if obligations changed",
      owner: "Chief Risk Officer",
    },
  ],
  insurance: [
    {
      action: "Assess disclosure and filing impact with the appointed actuary",
      owner: "Compliance Officer",
    },
    {
      action: "Update third-party due-diligence questionnaires if vendor rules changed",
      owner: "Vendor Risk Manager",
    },
  ],
};

function suggestedActions(pub: Publication): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  for (const sector of pub.sectors) {
    actions.push(...(SECTOR_ACTIONS[sector] ?? []));
  }
  actions.push(
    {
      action: "Confirm applicability across US and Canadian legal entities",
      owner: "Regulatory Affairs",
    },
    {
      action: "Add to the next GRC committee agenda with the mapped controls",
      owner: "GRC Lead",
    },
  );
  // Dedupe by action text, keep first owner.
  const seen = new Set<string>();
  return actions.filter((a) =>
    seen.has(a.action) ? false : (seen.add(a.action), true),
  );
}

/**
 * Deterministic briefing assembly. The briefing is COMPOSED, not generated:
 * every bullet is extracted from the source text, every control comes from
 * the validated taxonomy mapping, severity follows published rules, and
 * actions come from fixed templates. An auditor can re-run it and get the
 * identical briefing — try that with a free-form LLM.
 */
export function generateBriefing(
  pub: Publication,
  summary: Summary,
  mappings: ControlMapping[],
  controls: Control[],
  llmUsed: boolean,
): Briefing {
  const { severity, reasons } = classifySeverity(pub, summary);
  const generatedAt = new Date().toISOString();
  return {
    publicationId: pub.id,
    whatChanged: summary.whatChanged,
    affectedControls: mappings.map((m) => m.controlId),
    severity,
    severityReasons: reasons,
    suggestedActions: suggestedActions(pub),
    actionPlan: buildActionPlan(pub, severity, mappings, controls, generatedAt),
    generatedAt,
    llmUsed,
  };
}

// ---------------------------------------------------------------------------
// Action plans: concrete, ordered remediation steps. Deterministic templates
// only — titles, owners, and evidence cite the publication, the mapped
// controls, or the fixed rules below. Nothing is invented about the reader's
// institution.
// ---------------------------------------------------------------------------

const TRIAGE_SLA_DAYS: Record<Severity, number> = {
  critical: 3,
  high: 7,
  medium: 14,
  low: 30,
};

const REMEDIATION_SLA_DAYS: Record<Severity, number> = {
  critical: 14,
  high: 30,
  medium: 60,
  low: 90,
};

/** Framework → accountable role. Fixed rules, not per-institution facts. */
const FRAMEWORK_OWNERS: Array<{ match: RegExp; owner: string }> = [
  { match: /OSFI/i, owner: "Technology Risk Officer" },
  { match: /NYDFS|23 NYCRR/i, owner: "CISO" },
  { match: /NIST/i, owner: "Security Engineering Lead" },
  { match: /PCI/i, owner: "Payments Compliance Owner" },
  { match: /SOC 2|SOC2/i, owner: "GRC Lead" },
  { match: /NAIC/i, owner: "Insurance Compliance Officer" },
];

function ownerForFramework(framework: string): string {
  for (const rule of FRAMEWORK_OWNERS) {
    if (rule.match.test(framework)) return rule.owner;
  }
  return "Control Owner";
}

function dueDate(fromIso: string, days: number): string {
  const d = new Date(fromIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Ordered plan: Assess (confirm scope) → Remediate (one step per mapped
 * control, highest score first, capped at 5) → Verify (policy update +
 * attestation). Deterministic: same inputs always yield the same plan.
 */
export function buildActionPlan(
  pub: Publication,
  severity: Severity,
  mappings: ControlMapping[],
  controls: Control[],
  generatedAt: string,
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  const controlById = new Map(controls.map((c) => [c.id, c]));

  let order = 0;
  const push = (
    phase: ActionPlanPhase,
    title: string,
    detail: string,
    owner: string,
    due: string,
    evidence: string,
  ) => {
    order += 1;
    steps.push({
      id: `${pub.id}-step-${order}`,
      order,
      phase,
      title,
      detail,
      owner,
      dueDate: due,
      evidence,
      done: false,
    });
  };

  // Phase 1 — Assess: confirm the publication actually applies.
  push(
    "Assess",
    `Confirm applicability of "${truncate(pub.title, 90)}"`,
    `Review the ${pub.sectors.join("/")} scope against your legal entities and confirm this ${pub.jurisdiction === "CA" ? "Canadian" : "US"} publication applies before spending remediation effort.`,
    "Regulatory Affairs",
    dueDate(generatedAt, TRIAGE_SLA_DAYS[severity]),
    "Applicability decision recorded with rationale",
  );

  // Phase 2 — Remediate: one step per mapped control (top 5 by score).
  const top = [...mappings].sort((a, b) => b.score - a.score).slice(0, 5);
  for (const m of top) {
    const control = controlById.get(m.controlId);
    const controlLabel = control
      ? `${control.id} — ${control.title}`
      : m.controlId;
    const keywords = m.matchedKeywords.slice(0, 4).join(", ");
    push(
      "Remediate",
      `Close gaps against ${controlLabel}`,
      control
        ? `${control.description} Matched on: ${keywords || "framework terms"}.`
        : `Matched on: ${keywords || "framework terms"}.`,
      ownerForFramework(control?.framework ?? m.controlId),
      dueDate(generatedAt, REMEDIATION_SLA_DAYS[severity]),
      `Control self-assessment and gap log for ${m.controlId}`,
    );
  }

  // Phase 3 — Verify: policy update and attestation close the loop.
  push(
    "Verify",
    "Update policies and procedures",
    `Reflect the new obligations in written policy, citing the source publication (${truncate(pub.title, 70)}).`,
    "Policy Owner",
    dueDate(generatedAt, REMEDIATION_SLA_DAYS[severity]),
    "Revised policy document with approval record",
  );
  push(
    "Verify",
    "Record management attestation and file evidence",
    `File the briefing, gap logs, and revised policies as the audit evidence package for "${truncate(pub.title, 70)}".`,
    "GRC Lead",
    dueDate(generatedAt, REMEDIATION_SLA_DAYS[severity]),
    "Signed attestation + evidence package in the GRC repository",
  );

  return steps;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
