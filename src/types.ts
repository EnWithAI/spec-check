/**
 * Report contract types. Mirrors schema/spec-check-report.schema.json (schema_version 1.0); the schema test
 * validates real reports against the schema.
 */

/** Finding severity (categorical; no numeric score). */
export type Severity = "high" | "medium" | "low" | "info";
/** verified_static_fact = parser/structural fact; hypothesis = lexical judgement; unknown = undecidable. */
export type Status = "verified_static_fact" | "hypothesis" | "unknown";
/** Categorical confidence in a finding. */
export type Confidence = "high" | "medium" | "low";
/** Rule families. */
export type Category = "clarity" | "verifiability" | "coverage" | "integrity" | "ownership";
/** Kind of an inventoried requirement. */
export type RequirementKind = "functional" | "non_functional" | "success_criterion";
/** How a file was parsed. */
export type InputFormat = "spec-kit" | "markdown";

/** A source location supporting a finding. */
export interface Evidence {
  path: string;
  line_start: number;
  line_end: number;
  /** Short descriptor, e.g. the matched term or ID. */
  detail: string;
  /** Up to 160 characters of the line, redacted; null with --no-excerpts or for document-level evidence. */
  excerpt: string | null;
}

/** One rule result. */
export interface Finding {
  id: string;
  rule_id: string;
  category: Category;
  severity: Severity;
  status: Status;
  confidence: Confidence;
  is_heuristic: boolean;
  summary: string;
  explanation: string;
  recommended_human_action: string;
  evidence: Evidence[];
  requirement_ids: string[];
}

/** One inventoried requirement or success criterion. */
export interface Requirement {
  /** Declared ID (e.g. FR-001); null for un-numbered requirements in generic Markdown. */
  id: string | null;
  kind: RequirementKind;
  path: string;
  line_start: number;
  line_end: number;
  has_measure: boolean;
  /** IDs mentioned in the item's text (excluding its own). */
  references: string[];
  finding_ids: string[];
}

/** A finding that was suppressed by a front-matter key or a comment directive. */
export interface Suppression {
  rule_id: string;
  path: string;
  line: number;
  source: "front-matter" | "comment" | "config";
}

/** Something the analysis could not cover, stated explicitly. */
export interface Limitation {
  code: string;
  message: string;
  paths: string[];
  count: number;
}

/** One analyzed input file. */
export interface InputFile {
  path: string;
  sha256: string;
  lines: number;
  format: InputFormat;
  requirements: number;
  scenarios: number;
  user_stories: number;
}

/** Result of applying the policy (check command). */
export interface PolicyResult {
  evaluated: boolean;
  result: "pass" | "fail" | "not_evaluated";
  fail_on_severity: Severity | "never";
  fail_on_statuses: Status[];
  violations: string[];
}

/** The complete Spec Check report. */
export interface Report {
  schema_version: "1.0";
  inputs: InputFile[];
  summary: {
    files: number;
    requirements: number;
    success_criteria: number;
    scenarios: number;
    user_stories: number;
    findings: number;
    by_severity: Record<Severity, number>;
    by_status: Record<Status, number>;
    suppressed: number;
  };
  requirements: Requirement[];
  findings: Finding[];
  suppressions: Suppression[];
  coverage_limitations: Limitation[];
  policy: PolicyResult;
  run_metadata: {
    tool: "spec-check";
    tool_version: string;
    generated_at: string;
    duration_ms: number;
    node_version: string;
    config_source: string;
    language: "en";
    network: false;
    executed_code: false;
    model_usage: null;
  };
}
