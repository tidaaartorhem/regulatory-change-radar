import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  ListChecks,
  AlertTriangle,
  Cpu,
  ClipboardList,
} from "lucide-react";
import { getPublicationDetail } from "@/lib/data";
import { SeverityBadge } from "@/components/severity-badge";
import { ActionPlan } from "@/components/action-plan";
import { cn } from "@/lib/cn";

function FactCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-paper px-3 py-2.5">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <div className="text-sm font-semibold text-ink">{children}</div>
    </div>
  );
}

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default async function PublicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = getPublicationDetail(id);
  if (!detail) notFound();
  const { publication, source, briefing, mappings } = detail;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-[15px] text-primary underline-offset-2 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to feed
      </Link>

      <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
        <span className="font-semibold text-ink">{source?.name}</span>
        <span aria-hidden>·</span>
        <span>{publication.jurisdiction === "US" ? "United States" : "Canada"}</span>
        <span aria-hidden>·</span>
        <span>Retrieved {dateFmt(publication.ingestedAt)}</span>
      </p>

      <h1 className="mb-5 text-3xl font-bold leading-tight text-ink">
        {publication.title}
      </h1>

      {/* Key facts as stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <FactCard label="Severity">
          {briefing ? <SeverityBadge severity={briefing.severity} /> : "—"}
        </FactCard>
        <FactCard label="Controls touched">{mappings.length}</FactCard>
        <FactCard label="Published">{dateFmt(publication.publishedAt)}</FactCard>
        <FactCard label="Source regulator">{source?.shortName ?? "—"}</FactCard>
        <FactCard label="Retrieved">{dateFmt(publication.ingestedAt)}</FactCard>
        <FactCard label="Pipeline">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
            <Cpu className="h-4 w-4" aria-hidden />
            {briefing?.llmUsed ? "LLM gate fired" : "Deterministic — no LLM"}
          </span>
        </FactCard>
      </div>

      <section className="mb-6 rounded-md border border-line bg-paper p-6">
        <h2 className="mb-4 flex items-center gap-2 border-b border-line pb-3 text-lg font-bold text-navy">
          <ListChecks className="h-5 w-5 text-primary" aria-hidden /> What changed
        </h2>
        <ul className="space-y-3">
          {(briefing?.whatChanged ?? [publication.rawText]).map((b, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
              {b}
            </li>
          ))}
        </ul>
        {briefing && briefing.severityReasons.length > 0 && (
          <details className="mt-5 rounded border border-line bg-canvas px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
              <AlertTriangle className="h-4 w-4 text-sev-high-fg" aria-hidden />
              Why this severity ({briefing.severityReasons.length})
              <span className="ml-auto text-[13px] font-normal text-primary underline-offset-2 hover:underline">
                Show
              </span>
            </summary>
            <ul className="mt-3 space-y-1 border-t border-line pt-3">
              {briefing.severityReasons.map((r, i) => (
                <li key={i} className="text-sm text-ink-soft">· {r}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Action plan — ordered, trackable remediation steps */}
      {briefing && briefing.actionPlan.length > 0 && (
        <section className="mb-6 rounded-md border border-line bg-paper p-6">
          <h2 className="mb-4 flex items-center gap-2 border-b border-line pb-3 text-lg font-bold text-navy">
            <ClipboardList className="h-5 w-5 text-primary" aria-hidden /> Action plan
          </h2>
          <ActionPlan publicationId={publication.id} steps={briefing.actionPlan} />
        </section>
      )}

      <section className="mb-6 rounded-md border border-line bg-paper p-6">
        <h2 className="mb-4 flex items-center gap-2 border-b border-line pb-3 text-lg font-bold text-navy">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> Controls touched ({mappings.length})
        </h2>
        {mappings.length === 0 ? (
          <p className="text-[15px] text-ink-soft">
            No control mappings above the confidence threshold.
          </p>
        ) : (
          <div className="space-y-3">
            {mappings.map((m) => (
              <div key={m.controlId} className="rounded border border-line bg-canvas p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[15px] font-semibold text-ink">
                    <span className="mr-2 font-mono text-sm text-primary-dark">{m.controlId}</span>
                    {m.control?.title}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px]",
                      m.method === "llm-gate"
                        ? "border-sev-medium-fg/30 bg-sev-medium-bg text-sev-medium-fg"
                        : "border-sev-low-fg/20 bg-sev-low-bg text-sev-low-fg",
                    )}
                    title={m.method === "llm-gate" ? "Mapped via the gated LLM call site" : "Mapped by deterministic taxonomy scoring"}
                  >
                    {m.method}
                  </span>
                </div>
                <p className="mb-2 text-sm text-ink-soft">{m.control?.framework}</p>
                <div
                  className="mb-2 h-2 overflow-hidden rounded-full bg-line"
                  role="img"
                  aria-label={`Confidence ${Math.round(m.score * 100)} percent`}
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(m.score * 100)}%` }}
                  />
                </div>
                {m.matchedKeywords.length > 0 && (
                  <details className="text-[13px]">
                    <summary className="cursor-pointer list-none text-primary underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
                      Mapping evidence ({m.matchedKeywords.length} keywords)
                    </summary>
                    <p className="mt-1 text-ink-faint">
                      {m.matchedKeywords.join(", ")}
                    </p>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {briefing && briefing.suggestedActions.length > 0 && (
        <details className="mb-6 rounded-md border border-line bg-paper px-6 py-4">
          <summary className="cursor-pointer list-none text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
            Suggested actions ({briefing.suggestedActions.length})
            <span className="ml-2 text-sm font-normal text-primary underline-offset-2 hover:underline">
              Show
            </span>
          </summary>
          <table className="mt-3 w-full text-[15px]">
            <tbody>
              {briefing.suggestedActions.map((a, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-3 pr-4 text-ink">{a.action}</td>
                  <td className="whitespace-nowrap py-3 text-right text-sm text-ink-soft">
                    {a.owner}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <a
        href={publication.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded bg-primary px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-primary-dark"
      >
        View source publication <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
      <p className="mt-3 break-all text-[13px] text-ink-faint">
        Source:{" "}
        <a
          href={publication.url}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {publication.url}
        </a>
      </p>
    </div>
  );
}
