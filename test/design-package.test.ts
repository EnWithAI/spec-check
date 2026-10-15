// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Design-package profile (docs/SPEC.md §5a): opt-in behavior, config validation and rule edge cases beyond the
 * acceptance fixtures S14–S20.
 */
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config.js";
import { RULES } from "../src/rules/rules.js";
import { analyzeJson, cli, copyFixture, tempSpecs } from "./helpers.js";

const PROFILE_RULES = Object.keys(RULES).slice(12);
const profile = (extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ profile: "design-package", include: ["specs/*/*.md"], ...extra });

describe("design-package profile", () => {
  it("adds exactly eight rules to the catalog", () => {
    expect(PROFILE_RULES).toEqual([
      "adr-section-missing",
      "adr-status-invalid",
      "adr-supersede-dangling",
      "nfr-without-slo",
      "slo-without-sli",
      "security-considerations-missing",
      "ai-governance-missing",
      "design-package-incomplete",
    ]);
  });

  it("is off by default: the same fixtures produce none of its findings or limitations", async () => {
    for (const name of ["s15-adr-sections", "s18-slo", "s19-coverage", "s20-required-docs"]) {
      const dir = copyFixture(name);
      rmSync(join(dir, ".spec-check.json"));
      const report = await analyzeJson(dir, ["."]);
      expect(report.findings.filter((f) => PROFILE_RULES.includes(f.rule_id))).toEqual([]);
      expect(report.coverage_limitations.map((l) => l.code)).not.toContain("design-package-content");
    }
  });

  it("states the content limitation when enabled", async () => {
    const report = await analyzeJson(copyFixture("s14-design-clean"));
    expect(report.coverage_limitations.map((l) => l.code)).toContain("design-package-content");
    expect(report.inputs.map((i) => i.path)).toContain("docs/adr/README.md");
  });

  it("uses the --config path as evidence for missing documents", async () => {
    const dir = copyFixture("s20-required-docs");
    const report = await analyzeJson(join(dir, "specs"), [
      "--config",
      join(dir, ".spec-check.json"),
      "--cwd",
      dir,
    ]);
    const missing = report.findings.filter((f) => f.rule_id === "design-package-incomplete");
    expect(missing.map((f) => f.evidence[0]!.detail).sort()).toEqual(["architecture-model", "runbook"]);
    expect(
      missing.every((f) => f.evidence[0]!.path === ".spec-check.json" && f.evidence[0]!.excerpt === null)
    ).toBe(true);
  });

  it("honors custom required documents, ADR globs, sections and statuses", async () => {
    const dir = tempSpecs({
      ".spec-check.json": JSON.stringify({
        profile: "design-package",
        include: ["specs/*/*.md"],
        design_package: {
          adr_paths: ["architecture/decisions/*.md"],
          adr_sections: ["Context", "Decision"],
          adr_statuses: ["Draft", "Final"],
          required_documents: { "threat-model": ["**/THREATS.md"] },
        },
      }),
      "architecture/decisions/0001-a.md": "# A\n\nStatus: final\n\n## Context\n\nx\n\n## Decision\n\ny\n",
      "architecture/decisions/0002-b.md": "# B\n\nStatus: accepted\n\n## Context\n\nx\n\n## Decision\n\ny\n",
      "specs/001-a/spec.md": "# A\n\n## Threats\n\nNone.\n",
    });
    const report = await analyzeJson(dir);
    expect(report.findings.map((f) => [f.rule_id, f.evidence[0]!.path, f.evidence[0]!.detail])).toEqual([
      ["design-package-incomplete", ".spec-check.json", "threat-model"],
      ["adr-status-invalid", "architecture/decisions/0002-b.md", "accepted"],
    ]);
  });

  it("reads MADR front-matter supersede links, ignores external URLs and uninterpreted wording", async () => {
    const dir = tempSpecs({
      ".spec-check.json": profile({ design_package: { required_documents: {} } }),
      "docs/adr/0001-a.md":
        '---\nstatus: "superseded by ADR-0007"\n---\n# A\n\n## Context\n\nx\n\n## Decision\n\ny\n\n## Consequences\n\nz\n',
      "docs/adr/0002-b.md":
        "# B\n\n## Status\n\nSuperseded by [the wiki](https://example.com/adr/9)\n\n## Context\n\nx\n\n## Decision\n\ny\n\n## Consequences\n\nz\n",
      "docs/adr/0003-c.md":
        "# C\n\n## Status\n\nSuperseded by the payments decision\n\n## Context\n\nx\n\n## Decision\n\ny\n\n## Consequences\n\nz\n",
      "docs/adr/0004-d.md":
        "# D\n\n## Status\n\nSuperseded by [C](./0003-c.md)\n\n## Context\n\nx\n\n## Decision\n\ny\n\n## Consequences\n\nz\n",
    });
    const report = await analyzeJson(dir);
    expect(report.findings.map((f) => [f.rule_id, f.evidence[0]!.path, f.evidence[0]!.line_start])).toEqual([
      ["adr-supersede-dangling", "docs/adr/0001-a.md", 2],
    ]);
  });

  it("flags empty status headings as a missing status", async () => {
    const dir = tempSpecs({
      ".spec-check.json": profile({ design_package: { required_documents: {} } }),
      "docs/adr/0001-a.md":
        "# A\n\n## Status\n\n## Context\n\nx\n\n## Decision\n\ny\n\n## Consequences\n\nz\n",
    });
    const report = await analyzeJson(dir);
    expect(report.findings.map((f) => [f.rule_id, f.evidence[0]!.detail])).toEqual([
      ["adr-section-missing", "status"],
    ]);
  });

  it("checks service-level wording: windows, percentiles and indicators", async () => {
    const dir = tempSpecs({
      ".spec-check.json": profile({ design_package: { required_documents: {} } }),
      "specs/001-a/spec.md": [
        "# A",
        "",
        "## Requirements",
        "",
        "- **NFR-001**: Throughput MUST reach 200 requests.",
        "- **NFR-002**: Uptime MUST be 99.95% monthly.",
        "- **NFR-003**: p99 latency MUST stay under 1 second.",
        "- **NFR-004**: Error rate MUST stay below 1 in 1,000 over a rolling 7 days.",
        "- **NFR-005**: Exports MUST complete within 5 seconds.",
        "",
        "## Security",
        "",
        "Our SLOs are listed in `slo.yaml` and the error budget is 0.1%.",
        "",
        "Freshness SLO: 99% of records are under 5 minutes old over 28 days.",
      ].join("\n"),
    });
    const report = await analyzeJson(dir);
    expect(report.findings.map((f) => [f.rule_id, f.evidence[0]!.line_start])).toEqual([
      ["nfr-without-slo", 5],
      ["slo-without-sli", 13],
    ]);
  });

  it("exempts ADR folders from package rules and checks each package directory", async () => {
    const dir = tempSpecs({
      ".spec-check.json": profile({ design_package: { required_documents: {} } }),
      "docs/adr/README.md": "# Log\n\nWe use an LLM for nothing here.\n",
      "specs/001-a/spec.md": "# A\n\nUses a chatbot.\n",
      "specs/001-a/plan.md": "# Plan\n\n## Threat model\n\nx\n\n## Responsible AI\n\ny\n",
    });
    const report = await analyzeJson(dir);
    expect(report.findings).toEqual([]);
  });

  it("validates its config strictly", () => {
    const bad = [
      { profile: "strict" },
      { design_package: {} },
      { profile: "design-package", design_package: { unknown: true } },
      { profile: "design-package", design_package: { adr_paths: [] } },
      { profile: "design-package", design_package: { adr_sections: [] } },
      { profile: "design-package", design_package: { adr_statuses: ["ok!"] } },
      { profile: "design-package", design_package: { security_headings: "security" } },
      { profile: "design-package", design_package: { ai_governance_headings: [] } },
      { profile: "design-package", design_package: { required_documents: [] } },
      { profile: "design-package", design_package: { required_documents: { "Bad Name": ["x"] } } },
      { profile: "design-package", design_package: { required_documents: { runbook: [] } } },
      {
        profile: "design-package",
        design_package: {
          required_documents: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`d${i}`, ["x"]])),
        },
      },
    ];
    for (const raw of bad) expect(() => validateConfig(raw), JSON.stringify(raw)).toThrow(/Invalid config/);
    const ok = validateConfig({
      profile: "design-package",
      design_package: { security_headings: ["Security", "security"], ai_governance_headings: ["AI Risk"] },
    });
    expect(ok.designPackage.securityHeadings).toEqual(["security"]);
    expect(ok.designPackage.aiGovernanceHeadings).toEqual(["ai risk"]);
    expect(validateConfig({ profile: "default" }).profile).toBe("default");
  });

  it("does not block check under the default policy (medium findings only)", async () => {
    const result = await cli(["check", "--quiet"], copyFixture("s19-coverage"));
    expect(result.code).toBe(0);
  });

  it("can be suppressed per file like any other rule", async () => {
    const dir = copyFixture("s19-coverage");
    const path = join(dir, "specs/002-export/spec.md");
    writeFileSync(
      path,
      "---\nspec_check_disable: security-considerations-missing\n---\n# Export\n\n## Requirements\n\n- **FR-001**: System MUST reject exports over 10,000 rows with an error.\n\n## Performance\n\nWithin 10 seconds.\n"
    );
    const report = await analyzeJson(dir);
    expect(report.suppressions.map((s) => s.rule_id)).toEqual(["security-considerations-missing"]);
  });
});
