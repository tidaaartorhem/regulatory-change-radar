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
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-sky-300"
      >
        <ArrowLeft className="h-4 w-4" /> Back to feed
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="font-medium text-slate-200">{source?.name}</span>
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
          <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
            Demo seed
          </span>
        )}
      </div>

      <h1 className="mb-4 text-2xl font-bold leading-tight text-white">
        {publication.title}
      </h1>

      {briefing && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <SeverityBadge severity={briefing.severity} />
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Cpu className="h-3.5 w-3.5" />
            {briefing.llmUsed
              ? "LLM gate fired for taxonomy classification"
              : "Fully deterministic pipeline — no LLM involved"}
          </span>
        </div>
      )}

      <section className="mb-6 rounded-xl border border-[#1b2740] bg-[#0b1220]/80 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-sky-300">
          <ListChecks className="h-4 w-4" /> What changed
        </h2>
        <ul className="space-y-2.5">
          {(briefing?.whatChanged ?? [publication.rawText]).map((b, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-200">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
              {b}
            </li>
          ))}
        </ul>
        {briefing && briefing.severityReasons.length > 0 && (
          <div className="mt-4 border-t border-[#1b2740] pt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5" /> Why this severity
            </p>
            <ul className="space-y-1">
              {briefing.severityReasons.map((r, i) => (
                <li key={i} className="text-xs text-slate-400">· {r}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-[#1b2740] bg-[#0b1220]/80 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-sky-300">
          <ShieldCheck className="h-4 w-4" /> Controls touched ({mappings.length})
        </h2>
        {mappings.length === 0 ? (
          <p className="text-sm text-slate-400">
            No control mappings above the confidence threshold.
          </p>
        ) : (
          <div className="space-y-3">
            {mappings.map((m) => (
              <div key={m.controlId} className="rounded-lg bg-white/[0.03] p-3.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-100">
                    <span className="mr-2 font-mono text-xs text-sky-300">{m.controlId}</span>
                    {m.control?.title}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]",
                      m.method === "llm-gate"
                        ? "bg-violet-500/15 text-violet-300"
                        : "bg-emerald-500/15 text-emerald-300",
                    )}
                    title={m.method === "llm-gate" ? "Mapped via the gated LLM call site" : "Mapped by deterministic taxonomy scoring"}
                  >
                    {m.method}
                  </span>
                </div>
                <p className="mb-2 text-xs text-slate-400">{m.control?.framework}</p>
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-sky-400"
                    style={{ width: `${Math.round(m.score * 100)}%` }}
                  />
                </div>
                {m.matchedKeywords.length > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Evidence: {m.matchedKeywords.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {briefing && briefing.suggestedActions.length > 0 && (
        <section className="mb-6 rounded-xl border border-[#1b2740] bg-[#0b1220]/80 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-sky-300">
            Suggested actions
          </h2>
          <div className="overflow-hidden rounded-lg border border-[#1b2740]">
            <table className="w-full text-sm">
              <tbody>
                {briefing.suggestedActions.map((a, i) => (
                  <tr key={i} className={i % 2 ? "bg-white/[0.02]" : ""}>
                    <td className="px-4 py-2.5 text-slate-200">{a.action}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-slate-400">
                      {a.owner}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <a
        href={publication.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-[#060a13] transition hover:bg-sky-400"
      >
        View source publication <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
