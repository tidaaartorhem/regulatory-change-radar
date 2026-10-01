import Link from "next/link";
import { ArrowUpRight, Landmark } from "lucide-react";
import type { PublicationView } from "@/lib/data";
import { SeverityBadge } from "@/components/severity-badge";

export function PublicationCard({ view }: { view: PublicationView }) {
  const { publication, source, severity, mappingCount } = view;
  return (
    <Link
      href={`/publications/${publication.id}`}
      className="group block rounded-md border border-line bg-paper p-5 transition hover:border-primary"
    >
      <div className="mb-2 flex items-center gap-2 text-[13px] text-ink-soft">
        <Landmark className="h-4 w-4 text-primary" aria-hidden />
        <span className="font-semibold text-ink">
          {source?.shortName ?? publication.sourceId}
        </span>
        <span aria-hidden>·</span>
        <span>{publication.jurisdiction === "US" ? "United States" : "Canada"}</span>
        <span aria-hidden>·</span>
        <span>{new Date(publication.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        {publication.seeded && (
          <span className="ml-auto rounded bg-tag-bg px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-tag-fg">
            Demo seed
          </span>
        )}
      </div>
      <h2 className="mb-2 text-lg font-semibold leading-snug text-ink group-hover:text-primary-dark group-hover:underline">
        {publication.title}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={severity} />
        {publication.sectors.map((s) => (
          <span
            key={s}
            className="rounded border border-line bg-canvas px-2 py-0.5 text-xs capitalize text-ink-soft"
          >
            {s}
          </span>
        ))}
        <span className="text-xs text-ink-faint">
          {mappingCount} control{mappingCount === 1 ? "" : "s"} mapped
        </span>
        <ArrowUpRight className="ml-auto h-4 w-4 text-ink-faint transition group-hover:text-primary" aria-hidden />
      </div>
    </Link>
  );
}
