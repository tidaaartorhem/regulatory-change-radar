import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { RegulatorSource } from "@/lib/types";

const sources = JSON.parse(
  readFileSync(join(process.cwd(), "data", "sources.json"), "utf8"),
) as RegulatorSource[];

describe("sources config", () => {
  it("covers all required regulators across both jurisdictions", () => {
    const ids = new Set(sources.map((s) => s.id));
    for (const required of [
      "sec", "finra", "occ", "fdic", "fed", "cfpb", "nydfs", "naic",
      "cisa", "nist", "ftc",
      "osfi", "fcac", "boc", "fsra", "amf", "cccs",
    ]) {
      expect(ids.has(required)).toBe(true);
    }
  });

  it("has unique ids and valid jurisdictions", () => {
    const ids = sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sources) {
      expect(["US", "CA"]).toContain(s.jurisdiction);
      expect(s.sectors.length).toBeGreaterThan(0);
      expect(s.htmlUrl.startsWith("http")).toBe(true);
      expect(s.pollIntervalHours).toBeGreaterThan(0);
    }
  });

  it("marks RSS feeds only where a URL is configured", () => {
    for (const s of sources) {
      if (s.feedStatus === "rss-verified") {
        expect(s.rssUrl, `${s.id} marked rss-verified without a URL`).toBeTruthy();
      } else {
        expect(s.rssUrl, `${s.id} has an unverified RSS URL`).toBeUndefined();
      }
    }
  });

  it("keeps the verified RSS URLs stable", () => {
    const byId = new Map(sources.map((s) => [s.id, s]));
    expect(byId.get("sec")?.rssUrl).toBe("https://www.sec.gov/news/pressreleases.rss");
    expect(byId.get("cisa")?.rssUrl).toBe(
      "https://www.cisa.gov/cybersecurity-advisories/cybersecurity-advisories.xml",
    );
  });
});
