import type {
  Briefing,

  ControlMapping,
  Publication,
  Severity,
} from "@/lib/types";

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

/** Control-impact heatmap — top controls × most recent publications. */
function ControlHeatmap({
  publications,
  mappings,
}: {
  publications: Publication[];
  mappings: ControlMapping[];
}) {
  const recent = [...publications]
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .slice(0, 12);
  const countByControl = new Map<string, number>();
  for (const m of mappings)
    countByControl.set(m.controlId, (countByControl.get(m.controlId) ?? 0) + 1);
  const controls = [...countByControl.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id]) => id);
  const scoreOf = new Map<string, number>();
  for (const m of mappings) scoreOf.set(`${m.publicationId}|${m.controlId}`, m.score);

  const cell = 40;
  const labelW = 170;
  const colLabelH = 110;
  const W = labelW + recent.length * cell + 20;
  const H = colLabelH + controls.length * cell + 10;

  const fill = (score: number) => {
    // paper → primary tint → primary
    if (score <= 0) return "#f8f9fa";
    const t = Math.min(1, score);
    const r = Math.round(231 - t * (231 - 0));
    const g = Math.round(240 - t * (240 - 94));
    const b = Math.round(249 - t * (249 - 162));
    return `rgb(${r},${g},${b})`;
  };

  return (
    <ChartCard
      title="Control-impact heatmap"
      description="Which controls the most recent publications hit hardest (mapping confidence)."
    >
      {controls.length === 0 || recent.length === 0 ? (
        <p className="text-sm text-ink-soft">No mappings to display yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="min-w-[600px] w-full"
            role="img"
            aria-label="Heatmap of control mapping confidence across recent publications"
          >
            {recent.map((p, col) => (
              <text
                key={p.id}
                x={labelW + col * cell + cell / 2}
                y={colLabelH - 8}
                textAnchor="end"
                fontSize={11}
                fill="#565c65"
                transform={`rotate(-45 ${labelW + col * cell + cell / 2} ${colLabelH - 8})`}
              >
                {`${sourceShort(p.sourceId)} ${new Date(p.publishedAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`}
                <title>{p.title}</title>
              </text>
            ))}
            {controls.map((controlId, row) => (
              <g key={controlId}>
                <text
                  x={labelW - 8}
                  y={colLabelH + row * cell + cell / 2 + 4}
                  textAnchor="end"
                  fontSize={11}
                  fontFamily="ui-monospace, monospace"
                  fill="#1a4480"
                >
                  {controlId}
                </text>
                {recent.map((p, col) => {
                  const score = scoreOf.get(`${p.id}|${controlId}`) ?? 0;
                  return (
                    <rect
                      key={p.id}
                      x={labelW + col * cell + 2}
                      y={colLabelH + row * cell + 2}
                      width={cell - 4}
                      height={cell - 4}
                      rx={3}
                      fill={fill(score)}
                      stroke="#dfe1e2"
                    >
                      <title>
                        {score > 0
                          ? `${controlId} × ${p.title.slice(0, 60)} — confidence ${Math.round(score * 100)}%`
                          : `${controlId} × ${p.title.slice(0, 60)} — no mapping`}
                      </title>
                    </rect>
                  );
                })}
              </g>
            ))}
          </svg>
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 text-[13px] text-ink-soft">
        <span>No mapping</span>
        <span
          className="inline-block h-3 w-24 rounded-sm ring-1 ring-line"
          style={{
            background:
              "linear-gradient(to right, #f8f9fa, #e7f0f9, #005ea2)",
          }}
          aria-hidden
        />
        <span>High confidence</span>
      </div>
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
  mappings,
}: {
  publications: Publication[];
  briefings: Briefing[];
  mappings: ControlMapping[];
}) {
  return (
    <div className="mb-8 space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <SeverityBreakdown briefings={briefings} />
        <JurisdictionSplit publications={publications} />
      </div>
      <ActivityTimeline publications={publications} briefings={briefings} />
      <ControlHeatmap publications={publications} mappings={mappings} />
    </div>
  );
}
