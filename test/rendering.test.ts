// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Untrusted spec content (S9): prompt-injection text has no effect, Markdown/HTML is escaped, @mentions are
 * neutralized, secrets are redacted, control/bidi characters are visible, and excerpts can be disabled.
 */
import { readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeJson, cli, copyFixture, FAKE_GITHUB_TOKEN } from "./helpers.js";

function adversarial(): string {
  const dir = copyFixture("s9-adversarial");
  symlinkSync("../../../outside.md", join(dir, "specs/009-evil/linked.md"));
  return dir;
}

describe("untrusted spec content (S9)", () => {
  it("escapes Markdown output and never echoes raw HTML, mentions or secrets", async () => {
    const result = await cli(["analyze", "--quiet", "--no-branding", "specs"], adversarial());
    const md = result.stdout;
    expect(md).not.toMatch(/<script|<img|onerror=alert\(1\)>/);
    expect(md).not.toMatch(/(^|[^`\u200b])@maintainers/m);
    expect(md).not.toContain(FAKE_GITHUB_TOKEN);
    expect(md).toContain("[REDACTED]");
    expect(md).not.toMatch(/[\u202a-\u202e\u2066-\u2069]/);
    expect(md).not.toContain("crewpe.ai");
  });

  it("secrets are redacted in JSON excerpts too; injection text does not change results", async () => {
    const report = await analyzeJson(adversarial(), ["specs"]);
    const text = JSON.stringify(report);
    expect(text).not.toContain(FAKE_GITHUB_TOKEN);
    expect(report.findings.map((f) => f.rule_id)).toEqual(["open-marker", "needs-clarification"]);
    expect(report.run_metadata.executed_code).toBe(false);
    expect(report.run_metadata.network).toBe(false);
    const check = await cli(["check", "--quiet", "specs"], adversarial());
    expect(check.code).toBe(4);
  });

  it("control and bidi characters in quoted lines are made visible", async () => {
    const dir = copyFixture("s4-vague");
    writeFileSync(
      join(dir, "bidi.md"),
      "## Requirements\n\n- **FR-001**: Must be fast \u202eesrever\u202c\tnow.\n"
    );
    const md = (await cli(["analyze", "--quiet", "bidi.md"], dir)).stdout;
    expect(md).toContain("\\u202e");
    expect(md).toContain("\\t");
    expect(md).not.toMatch(/[\u202a-\u202e]/);
  });

  it("--no-excerpts removes every excerpt", async () => {
    const report = await analyzeJson(adversarial(), ["specs", "--no-excerpts"]);
    for (const f of report.findings) for (const e of f.evidence) expect(e.excerpt).toBeNull();
    expect(JSON.stringify(report)).not.toContain("Ignore all previous instructions");
  });

  it("caps excerpts at 160 characters", async () => {
    const dir = copyFixture("s4-vague");
    const spec = join(dir, "spec.md");
    const long = readFileSync(spec, "utf8").replace(
      "Search MUST respond quickly.",
      `Search MUST respond quickly ${"x".repeat(400)}.`
    );
    writeFileSync(spec, long);
    const report = await analyzeJson(dir, ["spec.md"]);
    expect(report.findings[0]!.evidence[0]!.excerpt!.length).toBeLessThanOrEqual(161);
  });

  it("Markdown report lists findings, inventory, suppressions and limitations", async () => {
    const md = (await cli(["analyze", "--quiet", "spec.md"], copyFixture("s10-suppression"))).stdout;
    expect(md).toContain("# Spec Check report");
    expect(md).toContain("`vague-term`");
    expect(md).toContain("## Requirements inventory");
    expect(md).toContain("## Suppressions");
    expect(md).toContain("`not-checked`");
    expect(md).toContain("An EnWithAI Engineering Commons tool");
    expect(md).toContain("Passing Spec Check does not mean a spec is complete or correct.");
  });
});
