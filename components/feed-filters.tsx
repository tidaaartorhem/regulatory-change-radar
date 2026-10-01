"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RegulatorSource } from "@/lib/types";

const SEVERITIES = ["critical", "high", "medium", "low"];
const SECTORS = ["banking", "insurance", "cyber"];
const JURISDICTIONS = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
];

function Select({
  label,
  param,
  options,
  current,
}: {
  label: string;
  param: string;
  options: Array<{ value: string; label: string }>;
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink">
      {label}
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-line-strong bg-paper px-3 py-2 text-[15px] text-ink"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FeedFilters({ sources }: { sources: RegulatorSource[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const hasFilters = [...searchParams.keys()].length > 0;

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-md border border-line bg-paper p-4">
      <Select
        label="Severity"
        param="severity"
        current={searchParams.get("severity") ?? ""}
        options={SEVERITIES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
      />
      <Select
        label="Regulator"
        param="regulator"
        current={searchParams.get("regulator") ?? ""}
        options={sources.map((s) => ({ value: s.id, label: s.shortName }))}
      />
      <Select
        label="Sector"
        param="sector"
        current={searchParams.get("sector") ?? ""}
        options={SECTORS.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
      />
      <Select
        label="Jurisdiction"
        param="jurisdiction"
        current={searchParams.get("jurisdiction") ?? ""}
        options={JURISDICTIONS}
      />
      {hasFilters && (
        <button
          onClick={() => router.replace(pathname, { scroll: false })}
          className="rounded border border-line-strong bg-paper px-3 py-2 text-[15px] text-primary underline-offset-2 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
