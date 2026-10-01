import { describe, expect, it } from "vitest";
import { scorePublication } from "@/lib/map/mapper";
import type { Control } from "@/lib/types";

const CONTROLS: Control[] = [
  {
    id: "NYDFS-500.16",
    framework: "NYDFS Part 500",
    title: "Cybersecurity event notification (72 hours)",
    description: "",
    sectors: ["banking"],
    keywords: ["72-hour", "notification", "cybersecurity event", "ransomware", "superintendent"],
  },
  {
    id: "NIST-CSF-RS.CO-02",
    framework: "NIST CSF 2.0",
    title: "Incident reporting",
    description: "",
    sectors: ["cyber"],
    keywords: ["incident reporting", "breach notification", "notify"],
  },
  {
    id: "PCI-DSS-8",
    framework: "PCI DSS v4.0",
    title: "Authenticate access",
    description: "",
    sectors: ["banking"],
    keywords: ["authentication", "MFA", "passwords"],
  },
];

const RANSOMWARE_TEXT =
  "Covered entities must notify the superintendent within 72 hours of a ransomware incident. " +
  "The notification must describe the cybersecurity event and any extortion payment made. " +
  "Firms should review incident reporting procedures for breach notification readiness.";

describe("scorePublication", () => {
  it("ranks the 72-hour notification controls top for ransomware text", () => {
    const mappings = scorePublication("p1", "NYDFS incident notification update", RANSOMWARE_TEXT, CONTROLS);
    expect(mappings.length).toBeGreaterThan(0);
    expect(mappings[0].controlId).toBe("NYDFS-500.16");
    expect(mappings.map((m) => m.controlId)).toContain("NIST-CSF-RS.CO-02");
  });

  it("weights title hits above body hits", () => {
    const titleHit = scorePublication("p1", "MFA authentication requirements", "General update text about programs.", CONTROLS);
    const bodyHit = scorePublication("p2", "General program update", "This text discusses MFA authentication requirements in depth.", CONTROLS);
    const tScore = titleHit.find((m) => m.controlId === "PCI-DSS-8")?.score ?? 0;
    const bScore = bodyHit.find((m) => m.controlId === "PCI-DSS-8")?.score ?? 0;
    expect(tScore).toBeGreaterThan(bScore);
  });

  it("reports matched keywords for explainability", () => {
    const mappings = scorePublication("p1", "Update", RANSOMWARE_TEXT, CONTROLS);
    const top = mappings[0];
    expect(top.matchedKeywords.length).toBeGreaterThan(0);
    expect(top.method).toBe("taxonomy");
  });

  it("returns nothing for unrelated noise", () => {
    const mappings = scorePublication(
      "p1",
      "Quarterly earnings call",
      "The bank reported quarterly earnings with net interest margin expanding across retail segments.",
      CONTROLS,
    );
    expect(mappings).toHaveLength(0);
  });

  it("caps results and sorts by score descending", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...CONTROLS[0],
      id: `CTRL-${i}`,
    }));
    const mappings = scorePublication("p1", "ransomware 72-hour notification", RANSOMWARE_TEXT, many);
    expect(mappings.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < mappings.length; i++) {
      expect(mappings[i - 1].score).toBeGreaterThanOrEqual(mappings[i].score);
    }
  });
});
