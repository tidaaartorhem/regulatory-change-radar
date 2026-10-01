# Regulatory Change Radar

> **Live demo:** https://regulatory-change-radar-1--truth-or-shots.us-east4.hosted.app

## The problem

Compliance teams at banks, insurers, and security organizations drown in
regulator publications across two countries. The SEC, OSFI, NYDFS, CISA, FINRA,
the Canadian Centre for Cyber Security, and a dozen more each publish guidance,
rules, advisories, and amendments on their own cadence, in their own formats.

Missing one update — an OSFI B-13 revision, a NYDFS Part 500 amendment, a new
SEC disclosure rule — means audit findings, rushed gap assessments, and board
questions nobody can answer quickly. Today this work is done by analysts with
Google Alerts and spreadsheets: slow, unrepeatable, and impossible to audit.

## What this automates

Regulatory Change Radar replaces the spreadsheet with a pipeline:

1. **Watch** — polls 17 US and Canadian regulators (RSS where feeds exist,
   Firecrawl-powered scraping where they don't).
2. **Dedupe** — content-hash fingerprinting means a re-published release is
   never triaged twice.
3. **Summarize** — each publication becomes plain-English "what changed"
   bullets plus extracted obligations (deadlines, effective dates).
4. **Map** — every item is scored against a fixed control taxonomy (NIST CSF
   2.0, OSFI B-13, NYDFS Part 500, NAIC model law, PCI DSS v4.0, SOC 2).
5. **Brief** — a severity rating with published rules, affected controls, and
   suggested actions with named owners.

The demo runs entirely on seeded data with **zero API keys**.

## The core concept: the Leashed LLM

In compliance, hallucination is unacceptable — every output must be auditable
and reproducible. So this system is built as a **deterministic pipeline with
exactly one LLM call site**:

- **Deterministic (plain code):** RSS fetching, sha256 dedupe, sentence
  extraction, taxonomy keyword scoring, severity rules, briefing assembly.
  Re-run the pipeline and you get byte-identical briefings.
- **The single gated call site** (`lib/map/llmGate.ts`): the model may do one
  job only — classify regulatory text against the *closed* control taxonomy.
  Its output is validated before it can influence anything: unknown control
  IDs are rejected, scores are clamped to [0, 1], and taxonomy evidence wins
  ties. If the adapter isn't LLM-backed (the default), the gate stays shut.
- **Transparency:** every briefing records `llmUsed`, and every mapping is
  labeled `taxonomy` or `llm-gate` with its evidence.

The lesson: don't ask the model to write the compliance briefing. Ask it to
point at the controls, then check its homework in code.

## Demo in 5 minutes

```bash
npm install
npm run dev        # http://localhost:3000
```

- **Feed** — filter publications by severity, regulator, sector, jurisdiction.
- **Publication detail** — what changed, why this severity, mapped controls
  with confidence bars and keyword evidence, suggested actions with owners.
- **Control Library** — browse the 29-control taxonomy the mapper uses.
- **Watchlist** — pick regulators, hit **Run scan**. With no keys configured,
  scans use the RSS adapters and seeded data; HTML-only sources explain why
  they're skipped until `FIRECRAWL_ENABLED=true`.

```bash
npm test            # 56 vitest tests
npm run build       # seeds data, then production build
```

## Architecture

```
data/
  sources.json            17 regulators: verified RSS URLs or HTML-fallback notes
  controls.seed.json      29 controls, 6 frameworks, keyword taxonomy
  publications.seed.json  9 realistic demo publications (labeled in the UI)
lib/
  ingest/
    rss.ts                RSS fetching (rss-parser)
    firecrawl.ts          scrape adapter for HTML-only sources (opt-in)
    live.ts               router: RSS first, then Firecrawl, else demo fallback
    hash.ts               sha256 content fingerprinting
    store.ts              JSON file store + dedupe
  summarize/
    adapter.ts            Summarizer interface
    demo.ts               deterministic template summarizer (default, zero keys)
    ollama.ts / openai.ts documented stubs for local / hosted models
  map/
    taxonomy.ts           the closed control taxonomy
    mapper.ts             deterministic keyword scoring with evidence
    llmGate.ts            THE single LLM call site (validated, clamped)
  brief/
    briefing.ts           deterministic briefing assembly (severity rules,
                          action templates, owner mapping)
  scan.ts                 pipeline: ingest → summarize → map → brief
  watchlist.ts            regulator selection persistence
app/
  page.tsx                dashboard feed + filters
  publications/[id]/      briefing detail view
  controls/               control library browser
  watchlist/              regulator toggles + Run scan
  actions.ts              server actions (scan, watchlist save)
scripts/seed.ts           build-time seeding: runs the real pipeline over seeds
```

### Ingestion adapters

| Source type | Adapter | Auth |
|---|---|---|
| RSS feed (SEC, CISA) | `rss.ts` | none needed |
| HTML-only newsroom (15 sources) | `firecrawl.ts` → Firecrawl skill CLI | stored `custom.firecrawl` credential via the skill's surrogate mechanism — the app never sees a raw key |
| No network / demo | seeded publications | none |

Enable live HTML scraping with `FIRECRAWL_ENABLED=true`. Without it, the
deployed demo stays fully offline on seeded data.

## Regulators watched

**US:** SEC, FINRA, OCC, FDIC, Federal Reserve, CFPB, NYDFS, NAIC, CISA, NIST, FTC
**Canada:** OSFI, FCAC, Bank of Canada, FSRA (Ontario), AMF (Québec), Canadian Centre for Cyber Security

RSS feeds are verified working for SEC and CISA (checked Oct 2026); the rest
use the Firecrawl scrape adapter against their newsroom pages.

## Control frameworks in the taxonomy

NIST CSF 2.0 · OSFI B-13 (Technology and Cyber Risk Management) · NYDFS Part
500 (23 NYCRR 500) · NAIC Insurance Data Security Model Law · PCI DSS v4.0 ·
SOC 2 Trust Services Criteria.

## Deployment

Deploys to Firebase App Hosting: `apphosting.yaml` runs `npm run build`,
which seeds the JSON store before `next build`, so the live demo boots with
content and zero configuration.

---

Built as one of 20 projects in 20 days. Author: Aadit Mehrotra.
