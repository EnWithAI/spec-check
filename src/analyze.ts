/**
 * Analysis pipeline: discover inputs → build spec models → run rules → apply config overrides and suppressions →
 * assign stable IDs → sort → build the requirements inventory, summary, limitations and policy result.
 */
import { createHash } from "node:crypto";
import type { Config } from "./config.js";
import { discover } from "./input/discover.js";
import { buildSpec, type SpecDoc } from "./parse/spec.js";
import { evaluatePolicy, notEvaluated } from "./policy.js";
import { redact } from "./report/redact.js";
import { hasMeasure, hasNumber } from "./rules/lexicon.js";
import { fileRules, RULES, setRules, type RawFinding } from "./rules/rules.js";
import type { Finding, Limitation, Report, Requirement, Severity, Status, Suppression } from "./types.js";
import { TOOL_VERSION } from "./version.js";

/** Options for one analysis run. */
export interface AnalyzeOptions {
  cwd: string;
  paths: string[];
  config: Config;
  configSource: string;
  /** Apply the policy (check command). */
  policy: boolean;
  excerpts: boolean;
  now?: () => Date;
}

/** Maximum findings kept in a report (limitation `finding-cap`). */
export const MAX_FINDINGS = 5000;
const EXCERPT_LENGTH = 160;

const SEVERITY_ORDER: Severity[] = ["high", "medium", "low", "info"];

/** Short hash used in finding IDs. */
function hash8(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 8);
}

/** Excerpt of one source line: trimmed, capped and redacted. */
function excerpt(lines: string[], line: number | null): string | null {
  if (line === null) return null;
  const text = (lines[line - 1] ?? "").trim();
  return redact(text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text);
}

/** Front-matter and comment suppressions for one file, as (rule, target line | null for whole file). */
function suppressionsOf(doc: SpecDoc): { rule: string; target: number | null; line: number; source: Suppression["source"] }[] {
  const out: { rule: string; target: number | null; line: number; source: Suppression["source"] }[] = [];
  const fm = doc.md.frontMatter?.values.spec_check_disable;
  if (fm) {
    for (const rule of fm.value.split(/[\s,]+/).filter(Boolean)) out.push({ rule, target: null, line: fm.line, source: "front-matter" });
  }
  for (const d of doc.md.directives) {
    for (const rule of d.rules) out.push({ rule, target: d.target, line: d.line, source: "comment" });
  }
  return out;
}

/** Runs the full analysis and returns a report (pure apart from reading input files and the clock). */
export function analyze(options: AnalyzeOptions): Report {
  const now = options.now ?? (() => new Date());
  const started = Date.now();
  const { config } = options;
  const discovered = discover(options.cwd, options.paths, config.include, config.exclude);
  const docs = discovered.files.map((f) => buildSpec(f.path, f.text, config.idPrefixes));
  const linesByPath = new Map(discovered.files.map((f) => [f.path, f.text.split(/\r?\n/)]));
  const docByPath = new Map(docs.map((d) => [d.path, d]));

  const disabled = Object.entries(config.rules)
    .filter(([, s]) => s === "off")
    .map(([r]) => r)
    .sort();
  const raw: RawFinding[] = [...docs.flatMap((d) => fileRules(d, config)), ...setRules(docs)].filter(
    (f) => !disabled.includes(f.rule)
  );

  // Suppressions.
  const suppressions: Suppression[] = [];
  const unknownDirectives: string[] = [];
  const kept = raw.filter((f) => {
    const doc = docByPath.get(f.path) as SpecDoc;
    const line = (f.locations[0] as { lineStart: number }).lineStart;
    const match = suppressionsOf(doc).find((s) => s.rule === f.rule && (s.target === null || s.target === line));
    if (!match) return true;
    suppressions.push({ rule_id: f.rule, path: f.path, line: match.line, source: match.source });
    return false;
  });
  for (const doc of docs)
    for (const s of suppressionsOf(doc)) if (!(s.rule in RULES)) unknownDirectives.push(doc.path);

  // Findings with stable IDs.
  const usedIds = new Set<string>();
  let findings: Finding[] = kept.map((f) => {
    const info = RULES[f.rule] as (typeof RULES)[string];
    const override = config.rules[f.rule];
    const status: Status = f.status ?? info.status;
    let id = `${f.rule}:${hash8(`${f.path}\0${f.rule}\0${f.key.replace(/\s+/g, " ").trim()}`)}`;
    for (let n = 2; usedIds.has(id); n++) id = `${f.rule}:${hash8(`${f.path}\0${f.rule}\0${f.key}\0${n}`)}`;
    usedIds.add(id);
    const lines = linesByPath.get(f.path) ?? [];
    return {
      id,
      rule_id: f.rule,
      category: info.category,
      severity: override && override !== "off" ? override.severity : (f.severity ?? info.severity),
      status,
      confidence: f.confidence ?? info.confidence,
      is_heuristic: status !== "verified_static_fact",
      summary: redact(f.summary),
      explanation: info.explanation,
      recommended_human_action: info.action,
      evidence: f.locations.map((l) => ({
        path: f.path,
        line_start: l.lineStart,
        line_end: l.lineEnd,
        detail: redact(l.detail),
        excerpt: options.excerpts ? excerpt(lines, l.excerptLine) : null,
      })),
      requirement_ids: f.requirementIds,
    };
  });
  findings.sort((a, b) => {
    const ea = a.evidence[0] as Finding["evidence"][number];
    const eb = b.evidence[0] as Finding["evidence"][number];
    if (ea.path !== eb.path) return ea.path < eb.path ? -1 : 1;
    if (ea.line_start !== eb.line_start) return ea.line_start - eb.line_start;
    if (a.rule_id !== b.rule_id) return a.rule_id < b.rule_id ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  suppressions.sort((a, b) =>
    a.path !== b.path ? (a.path < b.path ? -1 : 1) : a.line !== b.line ? a.line - b.line : a.rule_id < b.rule_id ? -1 : 1
  );

  const limitations: Limitation[] = [...discovered.limitations];
  if (findings.length > MAX_FINDINGS) {
    limitations.push({
      code: "finding-cap",
      message: `Only the first ${MAX_FINDINGS} findings (sorted by location) are listed.`,
      paths: [],
      count: findings.length - MAX_FINDINGS,
    });
    findings = findings.slice(0, MAX_FINDINGS);
  }

  // Requirements inventory.
  const requirements: Requirement[] = docs.flatMap((doc) =>
    doc.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      path: doc.path,
      line_start: item.block.lineStart,
      line_end: item.block.lineEnd,
      has_measure:
        item.kind === "success_criterion"
          ? hasMeasure(item.body)
          : hasNumber(item.body.replace(/\b[A-Z]{1,10}-\d{1,5}\b/g, " ")),
      references: item.references,
      finding_ids: findings
        .filter((f) => {
          const e = f.evidence[0] as Finding["evidence"][number];
          return e.path === doc.path && e.line_start >= item.block.lineStart && e.line_start <= item.block.lineEnd && f.requirement_ids.length > 0;
        })
        .map((f) => f.id),
    }))
  );

  const pathsWhere = (pred: (d: SpecDoc) => boolean): string[] => docs.filter(pred).map((d) => d.path);
  const noReq = pathsWhere((d) => d.items.length === 0);
  if (noReq.length > 0)
    limitations.push({
      code: "no-requirements-detected",
      message: "No requirement or success-criterion items were detected in these files; only clarity rules applied.",
      paths: noReq.slice(0, 50),
      count: noReq.length,
    });
  const subset = pathsWhere((d) => d.md.outsideSubset);
  if (subset.length > 0)
    limitations.push({
      code: "markdown-subset",
      message: "Setext headings or HTML blocks were treated as plain text.",
      paths: subset.slice(0, 50),
      count: subset.length,
    });
  const fmUnsupported = pathsWhere((d) => (d.md.frontMatter?.unsupportedLines ?? 0) > 0);
  if (fmUnsupported.length > 0)
    limitations.push({
      code: "front-matter-subset",
      message: "Only flat `key: value` front matter is read; other lines were ignored.",
      paths: fmUnsupported.slice(0, 50),
      count: fmUnsupported.length,
    });
  if (unknownDirectives.length > 0)
    limitations.push({
      code: "unknown-suppression",
      message: "Suppression directives named unknown rule IDs and had no effect.",
      paths: [...new Set(unknownDirectives)].sort(),
      count: unknownDirectives.length,
    });
  limitations.push(
    {
      code: "english-lexicon",
      message: "Vague-term, measure and coverage heuristics use English word lists.",
      paths: [],
      count: 0,
    },
    {
      code: "not-checked",
      message:
        "Section structure, requirement-to-test traceability and logical completeness are not checked. A clean report does not mean the spec is complete or correct.",
      paths: [],
      count: 0,
    }
  );
  limitations.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

  const bySeverity = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, findings.filter((f) => f.severity === s).length])) as Record<Severity, number>;
  const byStatus = Object.fromEntries(
    (["verified_static_fact", "hypothesis", "unknown"] as Status[]).map((s) => [s, findings.filter((f) => f.status === s).length])
  ) as Record<Status, number>;

  return {
    schema_version: "1.0",
    inputs: docs.map((doc) => {
      const file = discovered.files.find((f) => f.path === doc.path) as { sha256: string };
      return {
        path: doc.path,
        sha256: file.sha256,
        lines: doc.md.lineCount,
        format: doc.format,
        requirements: doc.items.length,
        scenarios: doc.scenarios.length,
        user_stories: doc.stories.length,
      };
    }),
    summary: {
      files: docs.length,
      requirements: requirements.filter((r) => r.kind !== "success_criterion").length,
      success_criteria: requirements.filter((r) => r.kind === "success_criterion").length,
      scenarios: docs.reduce((n, d) => n + d.scenarios.length, 0),
      user_stories: docs.reduce((n, d) => n + d.stories.length, 0),
      findings: findings.length,
      by_severity: bySeverity,
      by_status: byStatus,
      suppressed: suppressions.length,
    },
    requirements,
    findings,
    suppressions,
    coverage_limitations: limitations,
    policy: options.policy ? evaluatePolicy(findings, config) : notEvaluated(config),
    run_metadata: {
      tool: "spec-check",
      tool_version: TOOL_VERSION,
      generated_at: now().toISOString(),
      duration_ms: Math.max(0, Date.now() - started),
      node_version: process.version,
      config_source: options.configSource,
      disabled_rules: disabled,
      language: "en",
      network: false,
      executed_code: false,
      model_usage: null,
    },
  };
}
