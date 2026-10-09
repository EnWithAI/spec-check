/**
 * Configuration (.spec-check.json): defaults, strict validation and simple glob matching.
 * Configuration is data only: no JavaScript configs, no user-supplied regular expressions, unknown keys rejected.
 */
import { readFileSync } from "node:fs";
import { usageError } from "./errors.js";
import type { RequirementKind, Severity, Status } from "./types.js";

/** Per-rule override: turn a rule off or change its severity. */
export type RuleSetting = "off" | { severity: Severity };

/** Validated configuration with defaults applied. See docs/CONFIG.md. */
export interface Config {
  include: string[];
  exclude: string[];
  idPrefixes: Record<string, RequirementKind>;
  rules: Record<string, RuleSetting>;
  failOnSeverity: Severity | "never";
  failOnStatuses: Status[];
  requireOwner: boolean;
  vagueTermsAdd: string[];
  vagueTermsRemove: string[];
  excerpts: boolean;
}

/** Defaults used when no config file exists. */
export const DEFAULT_CONFIG: Config = {
  include: ["specs/*/spec.md"],
  exclude: [],
  idPrefixes: {
    FR: "functional",
    REQ: "functional",
    NFR: "non_functional",
    SC: "success_criterion",
    AC: "success_criterion",
  },
  rules: {},
  failOnSeverity: "high",
  failOnStatuses: ["verified_static_fact"],
  requireOwner: false,
  vagueTermsAdd: [],
  vagueTermsRemove: [],
  excerpts: true,
};

/** Every rule ID Spec Check knows (used to validate `rules` keys and suppression directives). */
export const RULE_IDS = [
  "needs-clarification",
  "template-placeholder",
  "open-marker",
  "vague-term",
  "unmeasurable-criterion",
  "scenario-incomplete",
  "story-without-scenarios",
  "missing-edge-cases",
  "missing-non-functional",
  "duplicate-id",
  "dangling-reference",
  "missing-owner",
] as const;

const SEVERITIES: readonly string[] = ["high", "medium", "low", "info"];
const STATUSES: readonly string[] = ["verified_static_fact", "hypothesis", "unknown"];
const KINDS: readonly string[] = ["functional", "non_functional", "success_criterion"];
const KEYS = [
  "$schema",
  "include",
  "exclude",
  "id_prefixes",
  "rules",
  "fail_on",
  "require_owner",
  "vague_terms",
  "excerpts",
];

/** Throws a usage error naming the offending config key. */
function bad(key: string, message: string): never {
  throw usageError(`Invalid config: ${key} ${message}`, "See docs/CONFIG.md.");
}

/** Validates an array of globs (no regex syntax beyond *, ** and ?). */
function globs(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((g) => typeof g !== "string" || g.length === 0 || g.length > 500))
    bad(key, "must be an array of non-empty strings");
  if (value.length > 200) bad(key, "has too many entries (max 200)");
  return value as string[];
}

/** Validates vague-term additions/removals: plain words only. */
function words(value: unknown, key: string): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some((w) => typeof w !== "string" || !/^[A-Za-z][A-Za-z' -]{0,40}$/.test(w))
  )
    bad(key, "must be an array of plain words (letters, spaces, hyphens)");
  return (value as string[]).map((w) => w.toLowerCase());
}

/** Validates a parsed JSON value and applies defaults. Exported for tests. */
export function validateConfig(raw: unknown): Config {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) bad("root", "must be a JSON object");
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) if (!KEYS.includes(key)) bad(key, "is not a known key");
  const config: Config = { ...DEFAULT_CONFIG, idPrefixes: { ...DEFAULT_CONFIG.idPrefixes } };

  if (obj.include !== undefined) config.include = globs(obj.include, "include");
  if (obj.exclude !== undefined) config.exclude = globs(obj.exclude, "exclude");
  if (obj.id_prefixes !== undefined) {
    const prefixes = obj.id_prefixes;
    if (prefixes === null || typeof prefixes !== "object" || Array.isArray(prefixes))
      bad("id_prefixes", "must be an object of PREFIX: kind");
    const entries = Object.entries(prefixes as Record<string, unknown>);
    if (entries.length === 0 || entries.length > 50) bad("id_prefixes", "must have 1–50 entries");
    config.idPrefixes = {};
    for (const [prefix, kind] of entries) {
      if (!/^[A-Z]{1,10}$/.test(prefix)) bad(`id_prefixes.${prefix}`, "must be 1–10 upper-case letters");
      if (typeof kind !== "string" || !KINDS.includes(kind))
        bad(`id_prefixes.${prefix}`, `must be one of ${KINDS.join(", ")}`);
      config.idPrefixes[prefix] = kind as RequirementKind;
    }
  }
  if (obj.rules !== undefined) {
    const rules = obj.rules;
    if (rules === null || typeof rules !== "object" || Array.isArray(rules))
      bad("rules", "must be an object");
    for (const [rule, setting] of Object.entries(rules as Record<string, unknown>)) {
      if (!(RULE_IDS as readonly string[]).includes(rule)) bad(`rules.${rule}`, "is not a known rule ID");
      if (setting === "off") config.rules[rule] = "off";
      else if (
        setting !== null &&
        typeof setting === "object" &&
        Object.keys(setting).length === 1 &&
        SEVERITIES.includes((setting as { severity?: unknown }).severity as string)
      )
        config.rules[rule] = { severity: (setting as { severity: Severity }).severity };
      else bad(`rules.${rule}`, `must be "off" or { "severity": "high|medium|low|info" }`);
    }
  }
  if (obj.fail_on !== undefined) {
    const failOn = obj.fail_on as Record<string, unknown>;
    if (failOn === null || typeof failOn !== "object" || Array.isArray(failOn))
      bad("fail_on", "must be an object");
    for (const key of Object.keys(failOn))
      if (key !== "severity" && key !== "statuses") bad(`fail_on.${key}`, "is not a known key");
    if (failOn.severity !== undefined) {
      if (typeof failOn.severity !== "string" || ![...SEVERITIES, "never"].includes(failOn.severity))
        bad("fail_on.severity", "must be high, medium, low, info or never");
      config.failOnSeverity = failOn.severity as Severity | "never";
    }
    if (failOn.statuses !== undefined) {
      const statuses = failOn.statuses;
      if (
        !Array.isArray(statuses) ||
        statuses.length === 0 ||
        statuses.some((s) => !STATUSES.includes(s as string))
      )
        bad("fail_on.statuses", `must be a non-empty array of ${STATUSES.join(", ")}`);
      config.failOnStatuses = [...new Set(statuses as Status[])].sort();
    }
  }
  if (obj.require_owner !== undefined) {
    if (typeof obj.require_owner !== "boolean") bad("require_owner", "must be a boolean");
    config.requireOwner = obj.require_owner;
  }
  if (obj.excerpts !== undefined) {
    if (typeof obj.excerpts !== "boolean") bad("excerpts", "must be a boolean");
    config.excerpts = obj.excerpts;
  }
  if (obj.vague_terms !== undefined) {
    const vague = obj.vague_terms as Record<string, unknown>;
    if (vague === null || typeof vague !== "object" || Array.isArray(vague))
      bad("vague_terms", "must be an object");
    for (const key of Object.keys(vague))
      if (key !== "add" && key !== "remove") bad(`vague_terms.${key}`, "is not a known key");
    config.vagueTermsAdd = words(vague.add, "vague_terms.add");
    config.vagueTermsRemove = words(vague.remove, "vague_terms.remove");
  }
  return config;
}

/** Reads and validates a config file. */
export function loadConfigFile(path: string): Config {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw usageError(`Cannot read config file: ${path}`);
  }
  if (text.length > 1024 * 1024) throw usageError("Config file is too large (max 1 MiB)");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw usageError(`Config file is not valid JSON: ${(error as Error).message}`);
  }
  return validateConfig(raw);
}

/** Convert a simple glob (`*`, `**`, `?`) to an anchored RegExp. No user regex syntax is honored. */
export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i] as string;
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        out += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else {
        out += "[^/]*";
      }
    } else if (ch === "?") {
      out += "[^/]";
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${out}$`);
}

/** True when the path matches at least one glob. */
export function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((g) => globToRegExp(g).test(path));
}
