import Link from "next/link";
import { ArrowUpRight, Landmark } from "lucide-react";
import type { PublicationView } from "@/lib/data";
import { SeverityBadge } from "@/components/severity-badge";

export function PublicationCard({ view }: { view: PublicationView }) {
  const { publication, source, severity, mappingCount } = view;
  return (
    <Link
      href={`/publications/${publication.id}`}
      className="group block rounded-xl border border-[#1b2740] bg-[#0b1220]/80 p-5 transition hover:border-sky-500/50 hover:bg-[#0e1628]"
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
        <Landmark className="h-3.5 w-3.5 text-sky-400" />
        <span className="font-medium text-slate-300">
          {source?.shortName ?? publication.sourceId}
        </span>
        <span aria-hidden>·</span>
        <span>{publication.jurisdiction === "US" ? "United States" : "Canada"}</span>
        <span aria-hidden>·</span>
        <span>{new Date(publication.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        {publication.seeded && (
          <span className="ml-auto rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
            Demo seed
          </span>
        )}
      </div>
      <h3 className="mb-2 text-[15px] font-semibold leading-snug text-slate-100 group-hover:text-sky-200">
        {publication.title}
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={severity} />
        {publication.sectors.map((s) => (
          <span
            key={s}
            className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] capitalize text-slate-400"
          >
            {s}
          </span>
        ))}
        <span className="text-[11px] text-slate-500">
          {mappingCount} control{mappingCount === 1 ? "" : "s"} mapped
        </span>
        <ArrowUpRight className="ml-auto h-4 w-4 text-slate-500 transition group-hover:text-sky-300" />
      </div>
    </Link>
  );
}
