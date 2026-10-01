import type {
  ActionPlanPhase,
  ActionPlanStep,
  Briefing,
  Publication,
  Severity,
} from "./types";

/** One remediation step enriched with its briefing's context. */
export interface ActionItem {
  publicationId: string;
  pubTitle: string;
  severity: Severity;
  step: ActionPlanStep;
}

export interface PhaseSummary {
  phase: ActionPlanPhase;
  total: number;
  done: number;
}

export interface ActionItemsSummary {
  items: ActionItem[];
  total: number;
  done: number;
  open: number;
  /** Percent complete, 0..100. */
  pct: number;
  byPhase: PhaseSummary[];
  /** Open and past due (severity SLAs define the due dates). */
  overdue: ActionItem[];
  /** Open and due within 7 days. */
  dueSoon: ActionItem[];
  /** Top 8 open items, sorted by severity then due date. */
  urgent: ActionItem[];
  /** Whole days from `nowMs` (UTC midnight) to an ISO date. */
  daysUntil: (iso: string) => number;
}

export const ACTION_PHASES: ActionPlanPhase[] = ["Assess", "Remediate", "Verify"];

const SEV_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Aggregate every briefing's action plan into one prioritized view.
 * Pure and deterministic — the dashboard component renders this.
 */
export function aggregateActionItems(
  publications: Publication[],
  briefings: Briefing[],
  nowMs: number = Date.now(),
): ActionItemsSummary {
  const pubById = new Map(publications.map((p) => [p.id, p]));
  const items: ActionItem[] = [];
  for (const b of briefings) {
    const pub = pubById.get(b.publicationId);
    if (!pub) continue;
    for (const s of b.actionPlan) {
      items.push({
        publicationId: b.publicationId,
        pubTitle: pub.title,
        severity: b.severity,
        step: s,
      });
    }
  }

  const total = items.length;
  const done = items.filter((i) => i.step.done).length;
  const open = total - done;

  const byPhase: PhaseSummary[] = ACTION_PHASES.map((phase) => {
    const list = items.filter((i) => i.step.phase === phase);
    return {
      phase,
      total: list.length,
      done: list.filter((i) => i.step.done).length,
    };
  });

  const todayUtc = new Date(nowMs);
  todayUtc.setUTCHours(0, 0, 0, 0);
  const daysUntil = (iso: string) =>
    Math.round(
      (new Date(`${iso}T00:00:00Z`).getTime() - todayUtc.getTime()) / 86400000,
    );

  const openItems = items.filter((i) => !i.step.done);
  const overdue = openItems.filter((i) => daysUntil(i.step.dueDate) < 0);
  const dueSoon = openItems.filter((i) => {
    const d = daysUntil(i.step.dueDate);
    return d >= 0 && d <= 7;
  });
  const urgent = [...openItems]
    .sort(
      (a, b) =>
        SEV_RANK[a.severity] - SEV_RANK[b.severity] ||
        a.step.dueDate.localeCompare(b.step.dueDate),
    )
    .slice(0, 8);

  return {
    items,
    total,
    done,
    open,
    pct: total === 0 ? 0 : Math.round((done / total) * 100),
    byPhase,
    overdue,
    dueSoon,
    urgent,
    daysUntil,
  };
}

/** Human label for a step's due date relative to today. */
export function dueLabel(
  daysUntil: (iso: string) => number,
  iso: string,
): string {
  const d = daysUntil(iso);
  if (d < 0) return `overdue ${-d}d`;
  if (d === 0) return "due today";
  return `due in ${d}d`;
}
