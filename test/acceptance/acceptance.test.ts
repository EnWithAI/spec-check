/**
 * Acceptance scenarios S1–S10 (docs/SPEC.md §7). Expectations in test/acceptance/expected/ were written by hand
 * from the specification before the analyzers existed (verification-first). A rule change must update them first.
 */
import { readdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeJson, cli, copyFixture } from "../helpers.js";

interface ExpectedFinding {
  rule_id: string;
  status: string;
  severity: string;
  path: string;
  line_start: number;
  requirement_ids: string[];
}
interface Expected {
  args: string[];
  policy: "pass" | "fail";
  findings: ExpectedFinding[];
  inventory?: [string | null, string, number, string[]][];
  limitations?: string[];
  suppressions?: { rule_id: string; path: string; line: number; source: string }[];
}

const expectedDir = new URL("./expected/", import.meta.url);
const cases = readdirSync(expectedDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

/** Copies the fixture; S9 additionally gets a symlink that must never be followed. */
function prepare(name: string): string {
  const dir = copyFixture(name);
  if (name === "s9-adversarial") {
    symlinkSync("../../../outside.md", join(dir, "specs/009-evil/linked.md"));
  }
  return dir;
}

describe("acceptance scenarios (docs/SPEC.md §7)", () => {
  it("covers S1–S11", () => {
    expect(cases).toHaveLength(11);
  });

  for (const name of cases) {
    const expected = JSON.parse(readFileSync(new URL(`${name}.json`, expectedDir), "utf8")) as Expected;

    it(`${name}: findings match the hand-written expectation exactly`, async () => {
      const report = await analyzeJson(prepare(name), expected.args);
      const actual = report.findings.map((f) => ({
        rule_id: f.rule_id,
        status: f.status,
        severity: f.severity,
        path: f.evidence[0]!.path,
        line_start: f.evidence[0]!.line_start,
        requirement_ids: f.requirement_ids,
      }));
      expect(actual).toEqual(expected.findings);
      for (const finding of report.findings) {
        expect(finding.is_heuristic).toBe(finding.status !== "verified_static_fact");
        expect(finding.evidence.length).toBeGreaterThan(0);
        expect(finding.recommended_human_action.length).toBeGreaterThan(0);
      }
    });

    it(`${name}: check exits ${expected.policy === "fail" ? 4 : 0} under the default policy`, async () => {
      const result = await cli(["check", "--quiet", ...expected.args], prepare(name));
      expect(result.code, result.stderr).toBe(expected.policy === "fail" ? 4 : 0);
    });

    if (expected.inventory) {
      it(`${name}: requirements inventory`, async () => {
        const report = await analyzeJson(prepare(name), expected.args);
        expect(report.requirements.map((r) => [r.id, r.kind, r.line_start, r.references])).toEqual(
          expected.inventory
        );
      });
    }
    if (expected.limitations) {
      it(`${name}: limitations reported`, async () => {
        const report = await analyzeJson(prepare(name), expected.args);
        const codes = report.coverage_limitations.map((l) => l.code);
        for (const code of expected.limitations!) expect(codes).toContain(code);
      });
    }
    if (expected.suppressions) {
      it(`${name}: suppressions are visible in the report`, async () => {
        const report = await analyzeJson(prepare(name), expected.args);
        expect(report.suppressions).toEqual(expected.suppressions);
      });
    }
  }
});
