import type { RequirementKind, Severity, Status } from "./types.js";
/** Per-rule override: turn a rule off or change its severity. */
export type RuleSetting = "off" | {
    severity: Severity;
};
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
    /** Where requirement IDs must be unique: per file (Spec Kit) or across all inputs. */
    idScope: "file" | "set";
}
/** Defaults used when no config file exists. */
export declare const DEFAULT_CONFIG: Config;
/** Every rule ID Spec Check knows (used to validate `rules` keys and suppression directives). */
export declare const RULE_IDS: readonly ["needs-clarification", "template-placeholder", "open-marker", "vague-term", "unmeasurable-criterion", "scenario-incomplete", "story-without-scenarios", "missing-edge-cases", "missing-non-functional", "duplicate-id", "dangling-reference", "missing-owner"];
/** Validates a parsed JSON value and applies defaults. Exported for tests. */
export declare function validateConfig(raw: unknown): Config;
/** Reads and validates a config file. */
export declare function loadConfigFile(path: string): Config;
/** Convert a simple glob (`*`, `**`, `?`) to an anchored RegExp. No user regex syntax is honored. */
export declare function globToRegExp(glob: string): RegExp;
/** True when the path matches at least one glob. */
export declare function matchesAny(path: string, patterns: readonly string[]): boolean;
