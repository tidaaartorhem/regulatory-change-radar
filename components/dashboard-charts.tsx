import Link from "next/link";
import type { Briefing, Publication, Severity } from "@/lib/types";
import {
  aggregateActionItems,
  dueLabel,
} from "@/lib/actionItems";

const SEV_DOT: Record<Severity, string> = {
  critical: "#8f1d1d",
  high: "#8a3c00",
  medium: "#5f4c00",
  low: "#3d4551",
};

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low"];

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-line bg-paper p-5">
      <h2 className="text-[15px] font-bold text-navy">{title}</h2>
      <p className="mb-4 mt-0.5 text-[13px] text-ink-faint">{description}</p>
      {children}
    </section>
  );
}

/** Severity breakdown — horizontal bars with counts. */
function SeverityBreakdown({ briefings }: { briefings: Briefing[] }) {
  const counts = new Map<Severity, number>(SEV_ORDER.map((s) => [s, 0]));
  for (const b of briefings) counts.set(b.severity, (counts.get(b.severity) ?? 0) + 1);
  const max = Math.max(1, ...counts.values());
  return (
    <ChartCard
      title="Severity breakdown"
      description="How the current feed rates by the published severity rules."
    >
      <div className="space-y-2.5">
        {SEV_ORDER.map((s) => {
          const n = counts.get(s) ?? 0;
          return (
            <div key={s} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-[13px] font-semibold capitalize text-ink-soft">
                {s}
              </span>
              <div className="h-4 flex-1 overflow-hidden rounded-sm bg-canvas ring-1 ring-line">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${Math.round((n / max) * 100)}%`,
                    backgroundColor: SEV_DOT[s],
                  }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-[13px] text-ink">
                {n}
              </span>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

/** US vs Canada split — paired bars. */
function JurisdictionSplit({ publications }: { publications: Publication[] }) {
  const rows = [
    { label: "United States", count: publications.filter((p) => p.jurisdiction === "US").length },
    { label: "Canada", count: publications.filter((p) => p.jurisdiction === "CA").length },
  ];
  const total = Math.max(1, rows[0].count + rows[1].count);
  return (
    <ChartCard
      title="US vs Canada"
      description="Feed coverage across the two tracked jurisdictions."
    >
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-ink-soft">{r.label}</span>
              <span className="font-mono text-[13px] text-ink">
                {r.count} · {Math.round((r.count / total) * 100)}%
              </span>
            </div>
            <div className="h-5 overflow-hidden rounded-sm bg-canvas ring-1 ring-line">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.round((r.count / total) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

/** Regulator activity timeline — publications per regulator over the last 60 days. */
function ActivityTimeline({
  publications,
  briefings,
}: {
  publications: Publication[];
  briefings: Briefing[];
}) {
  const sevById = new Map(briefings.map((b) => [b.publicationId, b.severity]));
  const now = Date.now();
  const windowDays = 60;
  const cutoff = now - windowDays * 86400000;
  const recent = publications.filter(
    (p) => new Date(p.publishedAt).getTime() >= cutoff,
  );

  const bySource = new Map<string, Publication[]>();
  for (const p of recent) {
    const list = bySource.get(p.sourceId) ?? [];
    list.push(p);
    bySource.set(p.sourceId, list);
  }
  const sources = [...bySource.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8);

  const W = 640;
  const rowH = 30;
  const labelW = 150;
  const H = sources.length * rowH + 40;
  const x = (t: number) =>
    labelW + ((t - cutoff) / (now - cutoff)) * (W - labelW - 16);

  const ticks = [45, 30, 15, 0].map((d) => {
    const t = now - d * 86400000;
    return {
      t,
      label:
        d === 0
          ? "today"
          : new Date(t).toLocaleDateString("en-US", {
              month: "numeric",
              day: "numeric",
            }),
    };
  });

  return (
    <ChartCard
      title="Regulator activity"
      description="Publications per regulator over the last 60 days; dot color = severity."
    >
      {sources.length === 0 ? (
        <p className="text-sm text-ink-soft">No publications in the last 60 days.</p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="min-w-[560px] w-full"
            role="img"
            aria-label="Timeline of regulator publications over the last 60 days"
          >
            {ticks.map(({ t, label }) => (
              <g key={label}>
                <line
                  x1={x(t)}
                  y1={8}
                  x2={x(t)}
                  y2={H - 28}
                  stroke="#dfe1e2"
                  strokeDasharray="3 3"
                />
                <text
                  x={x(t)}
                  y={H - 10}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#71767e"
                >
                  {label}
                </text>
              </g>
            ))}
            {sources.map(([sourceId, pubs], row) => (
              <g key={sourceId}>
                <text
                  x={labelW - 10}
                  y={row * rowH + 22}
                  textAnchor="end"
                  fontSize={12}
                  fontWeight={600}
                  fill="#1b1b1b"
                >
                  {sourceShort(sourceId)}
                </text>
                {pubs.map((p) => {
                  const t = new Date(p.publishedAt).getTime();
                  const sev = sevById.get(p.id) ?? "low";
                  return (
                    <circle
                      key={p.id}
                      cx={x(Math.max(t, cutoff))}
                      cy={row * rowH + 18}
                      r={4.5}
                      fill={SEV_DOT[sev]}
                    >
                      <title>{`${p.title} — ${sev}`}</title>
                    </circle>
                  );
                })}
              </g>
            ))}
          </svg>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-4">
        {SEV_ORDER.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SEV_DOT[s] }}
              aria-hidden
            />
            {s}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}

/**
 * Action items — every remediation step from every briefing's action plan,
 * aggregated into one prioritized view: overall completion, per-phase
 * progress, urgency (overdue / due within 7 days from the severity SLAs),
 * and the most urgent open actions with links back to their publications.
 */
function ActionItemsOverview({
  publications,
  briefings,
}: {
  publications: Publication[];
  briefings: Briefing[];
}) {
  const { total, done, open, pct, byPhase, overdue, dueSoon, urgent, daysUntil } =
    aggregateActionItems(publications, briefings);

  const dueClass = (iso: string) => {
    const d = daysUntil(iso);
    if (d < 0) return "text-sev-critical-fg font-semibold";
    if (d <= 7) return "text-sev-high-fg font-semibold";
    return "text-ink-soft";
  };

  return (
    <ChartCard
      title="Action items"
      description="Every remediation step across the feed, aggregated from each briefing's action plan and prioritized by severity and due date."
    >
      {total === 0 ? (
        <p className="text-sm text-ink-soft">No action plans yet.</p>
      ) : (
        <>
          <div className="mb-5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-ink-soft">
                Overall completion
              </span>
              <span className="font-mono text-[13px] text-ink">
                {done} of {total} · {pct}%
              </span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-sm bg-canvas ring-1 ring-line"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${done} of ${total} action items complete`}
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-3">
            {byPhase.map((p) => (
              <div
                key={p.phase}
                className="rounded-sm border border-line bg-canvas p-3"
              >
                <p className="text-[13px] font-bold text-navy">{p.phase}</p>
                <p className="mt-0.5 font-mono text-[13px] text-ink">
                  {p.done}/{p.total} done
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-sm bg-paper ring-1 ring-line">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${
                        p.total === 0
                          ? 0
                          : Math.round((p.done / p.total) * 100)
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-sm border border-line bg-paper px-3 py-1.5 text-[13px]">
              <span
                className="h-2.5 w-2.5 rounded-full bg-sev-critical-fg"
                aria-hidden
              />
              <strong className="font-mono">{overdue.length}</strong>
              <span className="text-ink-soft">overdue</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-sm border border-line bg-paper px-3 py-1.5 text-[13px]">
              <span
                className="h-2.5 w-2.5 rounded-full bg-sev-high-fg"
                aria-hidden
              />
              <strong className="font-mono">{dueSoon.length}</strong>
              <span className="text-ink-soft">due within 7 days</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-sm border border-line bg-paper px-3 py-1.5 text-[13px]">
              <span
                className="h-2.5 w-2.5 rounded-full bg-primary"
                aria-hidden
              />
              <strong className="font-mono">{open}</strong>
              <span className="text-ink-soft">open total</span>
            </span>
          </div>

          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-faint">
            Most urgent open actions
          </h3>
          {urgent.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Nothing open — every action is complete.
            </p>
          ) : (
            <ol className="divide-y divide-line rounded-sm border border-line bg-paper">
              {urgent.map((i) => (
                <li
                  key={i.step.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: SEV_DOT[i.severity] }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/publications/${i.publicationId}`}
                      className="block truncate text-[14px] font-semibold text-primary hover:underline"
                      title={i.step.title}
                    >
                      {i.step.title}
                    </Link>
                    <p
                      className="truncate text-[12px] text-ink-faint"
                      title={i.pubTitle}
                    >
                      {i.step.phase} · {i.step.owner} · {i.pubTitle}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[12px] ${dueClass(i.step.dueDate)}`}
                  >
                    {dueLabel(daysUntil, i.step.dueDate)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </ChartCard>
  );
}

function sourceShort(sourceId: string): string {
  const names: Record<string, string> = {
    sec: "SEC",
    cisa: "CISA",
    nist: "NIST",
    finra: "FINRA",
    occ: "OCC",
    fdic: "FDIC",
    fed: "Fed",
    cfpb: "CFPB",
    nydfs: "NYDFS",
    ftc: "FTC",
    osfi: "OSFI",
    naic: "NAIC",
    boc: "BoC",
    cccs: "CCCS",
    fcac: "FCAC",
    fsra: "FSRA",
    amf: "AMF",
  };
  return names[sourceId] ?? sourceId.toUpperCase();
}

export function DashboardCharts({
  publications,
  briefings,
}: {
  publications: Publication[];
  briefings: Briefing[];
}) {
  return (
    <div className="mb-8 space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <SeverityBreakdown briefings={briefings} />
        <JurisdictionSplit publications={publications} />
      </div>
      <ActivityTimeline publications={publications} briefings={briefings} />
      <ActionItemsOverview publications={publications} briefings={briefings} />
    </div>
  );
}
