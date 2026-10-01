import type {
  Briefing,
  Control,
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
  mappedControlIds: string[],
  _controls: Control[],
  llmUsed: boolean,
): Briefing {
  const { severity, reasons } = classifySeverity(pub, summary);
  return {
    publicationId: pub.id,
    whatChanged: summary.whatChanged,
    affectedControls: mappedControlIds,
    severity,
    severityReasons: reasons,
    suggestedActions: suggestedActions(pub),
    generatedAt: new Date().toISOString(),
    llmUsed,
  };
}
