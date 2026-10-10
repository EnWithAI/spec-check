// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Parser and rule edge cases: front matter, comments, fences, CRLF/BOM, table and heading IDs, Gherkin
 * backgrounds, scenario order, placeholder exclusions, owner rule, caps and discovery.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config.js";
import { parseMarkdown } from "../src/parse/markdown.js";
import { buildSpec } from "../src/parse/spec.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import { analyzeJson, tempSpecs } from "./helpers.js";

const rules = async (files: Record<string, string>, args: string[] = ["."]): Promise<string[]> =>
  (await analyzeJson(tempSpecs(files), args)).findings.map(
    (f) => `${f.rule_id}@${f.evidence[0]!.line_start}`
  );

const REQ = "## Requirements\n\n";
const OK_TAIL =
  "\n### Edge Cases\n\n- Invalid input is rejected with an error.\n\n- **NFR-001**: p95 latency under 200 ms.\n";

describe("markdown parser", () => {
  it("reads front matter, strips comments and fences, handles CRLF and BOM", () => {
    const md = parseMarkdown(
      "\ufeff---\r\nowner: team\r\nlist:\r\n  - a\r\n---\r\n# T\r\n<!-- a\r\nb -->\r\n- item\r\n```\r\n- code\r\n```\r\n"
    );
    expect(md.frontMatter?.values.owner?.value).toBe("team");
    expect(md.frontMatter?.unsupportedLines).toBe(1);
    expect(md.blocks.map((b) => [b.type, b.text])).toEqual([
      ["heading", "T"],
      ["item", "item"],
    ]);
  });

  it("joins list continuation lines and records directive targets", () => {
    const md = parseMarkdown(
      "- first\n  continued\n<!-- spec-check-disable-next-line vague-term, open-marker -->\n\n- second\n"
    );
    expect(md.blocks[0]).toMatchObject({ text: "first continued", lineStart: 1, lineEnd: 2 });
    expect(md.directives).toEqual([{ line: 3, target: 5, rules: ["vague-term", "open-marker"] }]);
  });

  it("flags setext headings and HTML blocks as outside the subset", () => {
    expect(parseMarkdown("Title\n=====\n").outsideSubset).toBe(true);
    expect(parseMarkdown("<div>\nx\n</div>\n").outsideSubset).toBe(true);
    expect(parseMarkdown("# ok\n\n---\n").outsideSubset).toBe(false);
  });

  it("detects table and heading definitions and references", () => {
    const doc = buildSpec(
      "x.md",
      "# Spec\n\n### FR-010: Heading requirement\n\n| ID | Text |\n|---|---|\n| FR-011 | Must work, see FR-010 |\n",
      DEFAULT_CONFIG.idPrefixes
    );
    expect(doc.definitions.map((d) => d.id).sort()).toEqual(["FR-010", "FR-011"]);
    expect(doc.items.map((i) => [i.id, i.references])).toEqual([["FR-011", ["FR-010"]]]);
  });
});

describe("rules", () => {
  it("scenarios: lowercase when/then accepted; out of order flagged; prose starting with When ignored", async () => {
    expect(
      await rules({
        "s.md": `${REQ}- **FR-001**: Must work.\n\nGiven a user, when they log in, then they see the dashboard.\n\n**Then** x **When** y **Given** z\n\nWhen the export finishes, the user is notified.\n${OK_TAIL}`,
      })
    ).toEqual(["scenario-incomplete@7"]);
  });

  it("Gherkin backgrounds supply Given; scenario outlines are parsed", async () => {
    const gherkin =
      "```gherkin\nFeature: f\n  Background:\n    Given a user\n  Scenario Outline: o\n    When x\n    Then y\n    And z\n```\n";
    expect(await rules({ "s.md": `${REQ}- **FR-001**: Must work.\n\n${gherkin}${OK_TAIL}` })).toEqual([]);
  });

  it("generic placeholders: links, checkboxes, footnotes, alerts, references and code spans are not placeholders", async () => {
    const body = `${REQ}- **FR-001**: Must work [see docs](https://x.example), [ ] [x] [^1] [ref label] \`[in code here]\`.\n\n> [!NOTE]\n> fine\n\n[ref label]: https://x.example\n${OK_TAIL}`;
    expect(await rules({ "s.md": body })).toEqual([]);
    expect(
      await rules({ "s.md": `${REQ}- **FR-001**: Must notify [the right people].\n${OK_TAIL}` })
    ).toEqual(["template-placeholder@3"]);
    const report = await analyzeJson(
      tempSpecs({ "s.md": `${REQ}- **FR-001**: Must notify [the right people].\n${OK_TAIL}` }),
      ["."]
    );
    expect(report.findings[0]!.status).toBe("hypothesis");
  });

  it("open markers only in requirements and scenarios; vague terms ignore code spans and IDs", async () => {
    expect(
      await rules({
        "s.md": `# Notes TODO\n\n${REQ}- **FR-001**: Must work. TODO\n- **FR-002**: Must use \`fast\` mode.\n- **FR-003**: Must be fast like FR-001.\n${OK_TAIL}`,
      })
    ).toEqual(["open-marker@5", "vague-term@7"]);
  });

  it("missing-owner only when required; front matter or **Owner**: satisfies it", async () => {
    const config = JSON.stringify({ require_owner: true });
    const base = `${REQ}- **FR-001**: Must work.\n${OK_TAIL}`;
    expect(await rules({ "s.md": base, ".spec-check.json": config }, ["s.md"])).toEqual(["missing-owner@1"]);
    expect(
      await rules({ "s.md": `**Owner**: payments\n\n${base}`, ".spec-check.json": config }, ["s.md"])
    ).toEqual([]);
    expect(
      await rules({ "s.md": `---\nowner: a\n---\n${base}`, ".spec-check.json": config }, ["s.md"])
    ).toEqual([]);
    expect(await rules({ "s.md": base }, ["s.md"])).toEqual([]);
  });

  it("custom id prefixes and vague terms from config", async () => {
    const cfg = JSON.stringify({
      id_prefixes: { RQ: "functional", KPI: "success_criterion" },
      vague_terms: { add: ["snappy"], remove: ["fast"] },
    });
    const report = await analyzeJson(
      tempSpecs({
        "s.md": `${REQ}- RQ-1: Must be snappy.\n- RQ-2: Must be fast.\n- KPI-1: Users like it.\n${OK_TAIL}`,
        ".spec-check.json": cfg,
      }),
      ["s.md"]
    );
    expect(report.findings.map((f) => `${f.rule_id}:${f.requirement_ids.join()}`)).toEqual([
      "vague-term:RQ-1",
      "unmeasurable-criterion:KPI-1",
    ]);
  });

  it('id_scope: per-file by default (Spec Kit numbering); "set" flags cross-file duplicates', async () => {
    const spec = `${REQ}- **FR-001**: Must work.\n${OK_TAIL}`;
    const files = { "specs/001-a/spec.md": spec, "specs/002-b/spec.md": spec };
    expect(await rules(files, ["specs"])).toEqual([]);
    const report = await analyzeJson(
      tempSpecs({ ...files, ".spec-check.json": JSON.stringify({ id_scope: "set" }) }),
      ["specs"]
    );
    const dups = report.findings
      .filter((f) => f.rule_id === "duplicate-id")
      .map((f) => f.requirement_ids[0])
      .sort();
    expect(dups).toEqual(["FR-001", "NFR-001"]);
    expect(report.findings.find((f) => f.rule_id === "duplicate-id")!.evidence.map((e) => e.path)).toEqual([
      "specs/001-a/spec.md",
      "specs/002-b/spec.md",
    ]);
  });

  it("unknown suppression rule IDs are reported as a limitation", async () => {
    const report = await analyzeJson(
      tempSpecs({
        "s.md": `<!-- spec-check-disable-next-line no-such-rule -->\n${REQ}- **FR-001**: Must work.\n${OK_TAIL}`,
      }),
      ["s.md"]
    );
    expect(report.coverage_limitations.map((l) => l.code)).toContain("unknown-suppression");
  });

  it("files without requirements get only clarity rules and a limitation", async () => {
    const report = await analyzeJson(
      tempSpecs({ "notes.md": "# Notes\n\nSomething [NEEDS CLARIFICATION: who?]\n" }),
      ["notes.md"]
    );
    expect(report.findings.map((f) => f.rule_id)).toEqual(["needs-clarification"]);
    expect(report.coverage_limitations.map((l) => l.code)).toContain("no-requirements-detected");
  });
});

describe("discovery and caps", () => {
  it("default include finds specs/*/spec.md and honors exclude", async () => {
    const files = {
      "specs/001-a/spec.md": `${REQ}- **FR-001**: Must work.\n${OK_TAIL}`,
      "specs/002-b/spec.md": "# b\n",
      "docs/other.md": "# x\n",
    };
    expect((await analyzeJson(tempSpecs(files))).inputs.map((i) => i.path)).toEqual([
      "specs/001-a/spec.md",
      "specs/002-b/spec.md",
    ]);
    const excluded = { ...files, ".spec-check.json": JSON.stringify({ exclude: ["specs/002-*/**"] }) };
    expect((await analyzeJson(tempSpecs(excluded))).inputs.map((i) => i.path)).toEqual([
      "specs/001-a/spec.md",
    ]);
  });

  it("skips files over 2 MiB and non-UTF-8 files with limitations; walks without node_modules", async () => {
    const dir = tempSpecs({ "a.md": "# a\n", "node_modules/x/README.md": "# no\n" });
    writeFileSync(join(dir, "big.md"), "x".repeat(2 * 1024 * 1024 + 1));
    writeFileSync(join(dir, "latin1.md"), Buffer.from([0x23, 0x20, 0xe9, 0x0a]));
    const report = await analyzeJson(dir, ["."]);
    expect(report.inputs.map((i) => i.path)).toEqual(["a.md"]);
    const codes = report.coverage_limitations.map((l) => l.code);
    expect(codes).toContain("too-large");
    expect(codes).toContain("binary-skipped");
  });
});

describe("config validation", () => {
  it("the documented example config is valid", () => {
    const example = JSON.parse(readFileSync(new URL("../.spec-check.example.json", import.meta.url), "utf8"));
    expect(validateConfig(example).requireOwner).toBe(false);
  });

  it("accepts a full valid config and rejects bad values", () => {
    const config = validateConfig({
      include: ["docs/**/*.md"],
      exclude: [],
      id_prefixes: { FR: "functional" },
      rules: { "vague-term": "off", "open-marker": { severity: "low" } },
      fail_on: { severity: "medium", statuses: ["hypothesis", "verified_static_fact"] },
      require_owner: true,
      vague_terms: { add: ["Snappy"], remove: [] },
      excerpts: false,
    });
    expect(config.vagueTermsAdd).toEqual(["snappy"]);
    expect(config.failOnStatuses).toEqual(["hypothesis", "verified_static_fact"]);
    for (const bad of [
      { include: "x" },
      { id_prefixes: { fr: "functional" } },
      { id_prefixes: { FR: "nope" } },
      { rules: { "vague-term": { severity: "huge" } } },
      { fail_on: { statuses: [] } },
      { fail_on: { other: 1 } },
      { require_owner: "yes" },
      { excerpts: 1 },
      { vague_terms: { add: ["(.*)"] } },
      { vague_terms: { other: [] } },
      { id_scope: "global" },
    ]) {
      expect(() => validateConfig(bad), JSON.stringify(bad)).toThrow(/Invalid config/);
    }
  });
});
