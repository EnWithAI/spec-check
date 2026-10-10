/**
 * Rule catalog and rule evaluation (docs/SPEC.md §5). Rules return raw findings with locations; the analyzer
 * assigns IDs, applies suppressions and sorts. Every rule is either a structural fact (verified_static_fact) or a
 * lexical judgement (hypothesis) and says so.
 */
import type { Config } from "../config.js";
import type { SpecDoc } from "../parse/spec.js";
import type { Category, Confidence, Severity, Status } from "../types.js";
/** Static description of a rule. */
export interface RuleInfo {
    id: string;
    category: Category;
    status: Status;
    severity: Severity;
    confidence: Confidence;
    title: string;
    explanation: string;
    action: string;
}
/** Rule catalog (also printed by `spec-check rules` and used for SARIF rule metadata). */
export declare const RULES: Record<string, RuleInfo>;
/** A rule result before IDs, suppressions and sorting. */
export interface RawFinding {
    rule: string;
    /** Overrides the catalog status (template-placeholder has a hypothesis variant). */
    status?: Status;
    severity?: Severity;
    confidence?: Confidence;
    summary: string;
    path: string;
    /** Evidence locations; `path` defaults to the finding's path (set for multi-file evidence). */
    locations: {
        path?: string;
        lineStart: number;
        lineEnd: number;
        detail: string;
        excerptLine: number | null;
    }[];
    requirementIds: string[];
    /** Stable text used for the finding ID. */
    key: string;
}
/** Per-file rules. */
export declare function fileRules(doc: SpecDoc, config: Config): RawFinding[];
/**
 * Integrity rules. Duplicates are counted per file (`id_scope: "file"`, the default: Spec Kit numbers FR-001 per
 * feature) or across the whole input set (`"set"`). References resolve against every analyzed file in both modes.
 */
export declare function setRules(docs: SpecDoc[], idScope: Config["idScope"]): RawFinding[];
