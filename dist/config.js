// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Configuration (.spec-check.json): defaults, strict validation and simple glob matching.
 * Configuration is data only: no JavaScript configs, no user-supplied regular expressions, unknown keys rejected.
 */
import { readFileSync } from "node:fs";
import { usageError } from "./errors.js";
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
