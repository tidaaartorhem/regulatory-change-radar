import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  ListChecks,
  AlertTriangle,
  Cpu,
} from "lucide-react";
import { getPublicationDetail } from "@/lib/data";
import { SeverityBadge } from "@/components/severity-badge";
import { cn } from "@/lib/cn";

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
        <span>
          {new Date(publication.publishedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        {publication.seeded && (
          <span className="rounded bg-tag-bg px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-tag-fg">
            Demo seed
          </span>
        )}
      </p>

      <h1 className="mb-4 text-3xl font-bold leading-tight text-ink">
        {publication.title}
      </h1>

      {briefing && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <SeverityBadge severity={briefing.severity} />
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
            <Cpu className="h-4 w-4" aria-hidden />
            {briefing.llmUsed
              ? "LLM gate fired for taxonomy classification"
              : "Fully deterministic pipeline — no LLM involved"}
          </span>
        </div>
      )}

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
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <AlertTriangle className="h-4 w-4 text-sev-high-fg" aria-hidden /> Why this severity
            </p>
            <ul className="space-y-1">
              {briefing.severityReasons.map((r, i) => (
                <li key={i} className="text-sm text-ink-soft">· {r}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

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
                  <p className="text-[13px] text-ink-faint">
                    Evidence: {m.matchedKeywords.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {briefing && briefing.suggestedActions.length > 0 && (
        <section className="mb-6 rounded-md border border-line bg-paper p-6">
          <h2 className="mb-4 border-b border-line pb-3 text-lg font-bold text-navy">
            Suggested actions
          </h2>
          <table className="w-full text-[15px]">
            <tbody>
              {briefing.suggestedActions.map((a, i) => (
                <tr key={i} className="border-t border-line first:border-t-0">
                  <td className="py-3 pr-4 text-ink">{a.action}</td>
                  <td className="whitespace-nowrap py-3 text-right text-sm text-ink-soft">
                    {a.owner}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <a
        href={publication.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded bg-primary px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-primary-dark"
      >
        View source publication <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    </div>
  );
}
