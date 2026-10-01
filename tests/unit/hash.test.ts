import { describe, expect, it } from "vitest";
import { contentHash, normalizeText, publicationId } from "@/lib/ingest/hash";

describe("normalizeText", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeText("  OSFI   B-13\nUpdate ")).toBe("osfi b-13 update");
  });

  it("is stable for identical input", () => {
    expect(normalizeText("abc")).toBe(normalizeText("abc"));
  });
});

describe("contentHash", () => {
  const title = "OSFI B-13 Technology and Cyber Risk Management";
  const text = "Revised guideline strengthens incident reporting expectations.";

  it("is deterministic for identical input", () => {
    expect(contentHash(title, text)).toBe(contentHash(title, text));
  });

  it("changes when the text changes", () => {
    expect(contentHash(title, text)).not.toBe(contentHash(title, text + " more"));
  });

  it("changes when the title changes", () => {
    expect(contentHash(title, text)).not.toBe(contentHash("Other title", text));
  });

  it("ignores case and whitespace differences", () => {
    expect(contentHash(title, text)).toBe(
      contentHash("  " + title.toUpperCase() + "  ", text.replace(/ /g, "  ")),
    );
  });

  it("produces a 64-char hex digest", () => {
    expect(contentHash(title, text)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("publicationId", () => {
  it("prefixes the source id and is stable", () => {
    const h = contentHash("t", "x");
    expect(publicationId("osfi", h)).toBe(publicationId("osfi", h));
    expect(publicationId("osfi", h).startsWith("osfi-")).toBe(true);
  });
});
