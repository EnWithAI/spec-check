// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Configuration (.spec-check.json): defaults, strict validation and simple glob matching.
 * Configuration is data only: no JavaScript configs, no user-supplied regular expressions, unknown keys rejected.
 */
import { readFileSync } from "node:fs";
import { usageError } from "./errors.js";
/** Default design-package settings. */
export const DEFAULT_DESIGN_PACKAGE = {
    adrPaths: ["doc/adr/*.md", "docs/adr/*.md", "docs/decisions/*.md"],
    adrSections: ["context", "decision", "consequences"],
    adrStatuses: ["proposed", "accepted", "rejected", "deprecated", "superseded"],
    securityHeadings: ["security", "threat"],
    aiGovernanceHeadings: ["ai governance", "responsible ai", "ai risk", "model governance"],
    requiredDocuments: null,
};
/** Required documents in effect (defaults resolved against the ADR globs). */
export function requiredDocuments(dp) {
    return (dp.requiredDocuments ?? {
        "architecture-model": [
            "**/workspace.dsl",
            "**/workspace.json",
            "**/*.calm.json",
            "docs/architecture/**",
        ],
        "decision-records": dp.adrPaths,
        runbook: ["**/runbook*.md", "**/runbooks/**", "docs/operations/**"],
    });
}
/** Defaults used when no config file exists. */
export const DEFAULT_CONFIG = {
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
    idScope: "file",
    profile: "default",
    designPackage: DEFAULT_DESIGN_PACKAGE,
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
    "adr-section-missing",
    "adr-status-invalid",
    "adr-supersede-dangling",
    "nfr-without-slo",
    "slo-without-sli",
    "security-considerations-missing",
    "ai-governance-missing",
    "design-package-incomplete",
];
const SEVERITIES = ["high", "medium", "low", "info"];
const STATUSES = ["verified_static_fact", "hypothesis", "unknown"];
const KINDS = ["functional", "non_functional", "success_criterion"];
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
    "id_scope",
    "profile",
    "design_package",
];
const DESIGN_PACKAGE_KEYS = [
    "adr_paths",
    "adr_sections",
    "adr_statuses",
    "security_headings",
    "ai_governance_headings",
    "required_documents",
];
/** Throws a usage error naming the offending config key. */
function bad(key, message) {
    throw usageError(`Invalid config: ${key} ${message}`, "See docs/CONFIG.md.");
}
/** Validates an array of globs (no regex syntax beyond *, ** and ?). */
function globs(value, key) {
    if (!Array.isArray(value) || value.some((g) => typeof g !== "string" || g.length === 0 || g.length > 500))
        bad(key, "must be an array of non-empty strings");
    if (value.length > 200)
        bad(key, "has too many entries (max 200)");
    return value;
}
/** Validates vague-term additions/removals: plain words only. */
function words(value, key) {
    if (value === undefined)
        return [];
    if (!Array.isArray(value) ||
        value.some((w) => typeof w !== "string" || !/^[A-Za-z][A-Za-z' -]{0,40}$/.test(w)))
        bad(key, "must be an array of plain words (letters, spaces, hyphens)");
    return value.map((w) => w.toLowerCase());
}
/** Validates a required, non-empty list of plain words. */
function wordList(value, key) {
    const list = words(value, key);
    if (list.length === 0 || list.length > 50)
        bad(key, "must have 1–50 entries");
    return [...new Set(list)];
}
/** Validates the `design_package` object. */
function designPackage(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw))
        bad("design_package", "must be an object");
    const obj = raw;
    for (const key of Object.keys(obj))
        if (!DESIGN_PACKAGE_KEYS.includes(key))
            bad(`design_package.${key}`, "is not a known key");
    const dp = { ...DEFAULT_DESIGN_PACKAGE };
    if (obj.adr_paths !== undefined) {
        dp.adrPaths = globs(obj.adr_paths, "design_package.adr_paths");
        if (dp.adrPaths.length === 0)
            bad("design_package.adr_paths", "must not be empty");
    }
    if (obj.adr_sections !== undefined)
        dp.adrSections = wordList(obj.adr_sections, "design_package.adr_sections");
    if (obj.adr_statuses !== undefined)
        dp.adrStatuses = wordList(obj.adr_statuses, "design_package.adr_statuses");
    if (obj.security_headings !== undefined)
        dp.securityHeadings = wordList(obj.security_headings, "design_package.security_headings");
    if (obj.ai_governance_headings !== undefined)
        dp.aiGovernanceHeadings = wordList(obj.ai_governance_headings, "design_package.ai_governance_headings");
    if (obj.required_documents !== undefined) {
        const docs = obj.required_documents;
        if (docs === null || typeof docs !== "object" || Array.isArray(docs))
            bad("design_package.required_documents", "must be an object of name: [globs]");
        const entries = Object.entries(docs);
        if (entries.length > 20)
            bad("design_package.required_documents", "has too many entries (max 20)");
        dp.requiredDocuments = {};
        for (const [name, patterns] of entries) {
            if (!/^[a-z][a-z0-9-]{0,40}$/.test(name))
                bad(`design_package.required_documents.${name}`, "must be a lower-case name (letters, digits, hyphens)");
            const list = globs(patterns, `design_package.required_documents.${name}`);
            if (list.length === 0)
                bad(`design_package.required_documents.${name}`, "must not be empty");
            dp.requiredDocuments[name] = list;
        }
    }
    return dp;
}
/** Validates a parsed JSON value and applies defaults. Exported for tests. */
export function validateConfig(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw))
        bad("root", "must be a JSON object");
    const obj = raw;
    for (const key of Object.keys(obj))
        if (!KEYS.includes(key))
            bad(key, "is not a known key");
    const config = { ...DEFAULT_CONFIG, idPrefixes: { ...DEFAULT_CONFIG.idPrefixes } };
    if (obj.include !== undefined)
        config.include = globs(obj.include, "include");
    if (obj.exclude !== undefined)
        config.exclude = globs(obj.exclude, "exclude");
    if (obj.id_prefixes !== undefined) {
        const prefixes = obj.id_prefixes;
        if (prefixes === null || typeof prefixes !== "object" || Array.isArray(prefixes))
            bad("id_prefixes", "must be an object of PREFIX: kind");
        const entries = Object.entries(prefixes);
        if (entries.length === 0 || entries.length > 50)
            bad("id_prefixes", "must have 1–50 entries");
        config.idPrefixes = {};
        for (const [prefix, kind] of entries) {
            if (!/^[A-Z]{1,10}$/.test(prefix))
                bad(`id_prefixes.${prefix}`, "must be 1–10 upper-case letters");
            if (typeof kind !== "string" || !KINDS.includes(kind))
                bad(`id_prefixes.${prefix}`, `must be one of ${KINDS.join(", ")}`);
            config.idPrefixes[prefix] = kind;
        }
    }
    if (obj.rules !== undefined) {
        const rules = obj.rules;
        if (rules === null || typeof rules !== "object" || Array.isArray(rules))
            bad("rules", "must be an object");
        for (const [rule, setting] of Object.entries(rules)) {
            if (!RULE_IDS.includes(rule))
                bad(`rules.${rule}`, "is not a known rule ID");
            if (setting === "off")
                config.rules[rule] = "off";
            else if (setting !== null &&
                typeof setting === "object" &&
                Object.keys(setting).length === 1 &&
                SEVERITIES.includes(setting.severity))
                config.rules[rule] = { severity: setting.severity };
            else
                bad(`rules.${rule}`, `must be "off" or { "severity": "high|medium|low|info" }`);
        }
    }
    if (obj.fail_on !== undefined) {
        const failOn = obj.fail_on;
        if (failOn === null || typeof failOn !== "object" || Array.isArray(failOn))
            bad("fail_on", "must be an object");
        for (const key of Object.keys(failOn))
            if (key !== "severity" && key !== "statuses")
                bad(`fail_on.${key}`, "is not a known key");
        if (failOn.severity !== undefined) {
            if (typeof failOn.severity !== "string" || ![...SEVERITIES, "never"].includes(failOn.severity))
                bad("fail_on.severity", "must be high, medium, low, info or never");
            config.failOnSeverity = failOn.severity;
        }
        if (failOn.statuses !== undefined) {
            const statuses = failOn.statuses;
            if (!Array.isArray(statuses) ||
                statuses.length === 0 ||
                statuses.some((s) => !STATUSES.includes(s)))
                bad("fail_on.statuses", `must be a non-empty array of ${STATUSES.join(", ")}`);
            config.failOnStatuses = [...new Set(statuses)].sort();
        }
    }
    if (obj.require_owner !== undefined) {
        if (typeof obj.require_owner !== "boolean")
            bad("require_owner", "must be a boolean");
        config.requireOwner = obj.require_owner;
    }
    if (obj.excerpts !== undefined) {
        if (typeof obj.excerpts !== "boolean")
            bad("excerpts", "must be a boolean");
        config.excerpts = obj.excerpts;
    }
    if (obj.id_scope !== undefined) {
        if (obj.id_scope !== "file" && obj.id_scope !== "set")
            bad("id_scope", 'must be "file" or "set"');
        config.idScope = obj.id_scope;
    }
    if (obj.profile !== undefined) {
        if (obj.profile !== "default" && obj.profile !== "design-package")
            bad("profile", 'must be "default" or "design-package"');
        config.profile = obj.profile;
    }
    if (obj.design_package !== undefined) {
        if (config.profile !== "design-package")
            bad("design_package", 'requires "profile": "design-package"');
        config.designPackage = designPackage(obj.design_package);
    }
    if (obj.vague_terms !== undefined) {
        const vague = obj.vague_terms;
        if (vague === null || typeof vague !== "object" || Array.isArray(vague))
            bad("vague_terms", "must be an object");
        for (const key of Object.keys(vague))
            if (key !== "add" && key !== "remove")
                bad(`vague_terms.${key}`, "is not a known key");
        config.vagueTermsAdd = words(vague.add, "vague_terms.add");
        config.vagueTermsRemove = words(vague.remove, "vague_terms.remove");
    }
    return config;
}
/** Reads and validates a config file. */
export function loadConfigFile(path) {
    let text;
    try {
        text = readFileSync(path, "utf8");
    }
    catch {
        throw usageError(`Cannot read config file: ${path}`);
    }
    if (text.length > 1024 * 1024)
        throw usageError("Config file is too large (max 1 MiB)");
    let raw;
    try {
        raw = JSON.parse(text);
    }
    catch (error) {
        throw usageError(`Config file is not valid JSON: ${error.message}`);
    }
    return validateConfig(raw);
}
/** Convert a simple glob (`*`, `**`, `?`) to an anchored RegExp. No user regex syntax is honored. */
export function globToRegExp(glob) {
    let out = "";
    for (let i = 0; i < glob.length; i++) {
        const ch = glob[i];
        if (ch === "*") {
            if (glob[i + 1] === "*") {
                const slash = glob[i + 2] === "/";
                out += slash ? "(?:.*/)?" : ".*";
                i += slash ? 2 : 1;
            }
            else {
                out += "[^/]*";
            }
        }
        else if (ch === "?") {
            out += "[^/]";
        }
        else {
            out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        }
    }
    return new RegExp(`^${out}$`);
}
/** True when the path matches at least one glob. */
export function matchesAny(path, patterns) {
    return patterns.some((g) => globToRegExp(g).test(path));
}
