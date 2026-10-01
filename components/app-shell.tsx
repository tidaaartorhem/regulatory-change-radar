import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const NAV = [
  { href: "/", label: "Regulatory feed" },
  { href: "/controls", label: "Control library" },
  { href: "/watchlist", label: "Watchlist" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Thin utility bar — official-service feel, honestly labeled. */}
      <div className="bg-navy-deep text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-1.5 text-[11px] uppercase tracking-widest text-white/80">
          <span>Demonstration project</span>
          <span className="hidden sm:inline">
            US + Canada &middot; Banking &middot; Insurance &middot; Cyber
          </span>
        </div>
      </div>

      {/* Federal-style header bar (Canada.ca #26374a). */}
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded border border-white/30">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-lg font-semibold leading-tight">
                Regulatory Change Radar
              </span>
              <span className="block text-xs text-white/75">
                Horizon scanning for compliance teams
              </span>
            </span>
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded px-3 py-2 text-[15px] text-white/90 underline-offset-4 hover:bg-white/10 hover:text-white hover:underline"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        {children}
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto max-w-6xl px-5 py-5 text-sm text-ink-soft">
          <p className="font-medium text-ink">
            Demonstration project. Not affiliated with any government agency or
            regulator.
          </p>
          <p className="mt-1 text-[13px]">
            Demo data is seeded and clearly labeled. Connect a summarizer
            adapter to run live scans against regulator feeds.
          </p>
        </div>
      </footer>
    </div>
  );
}
