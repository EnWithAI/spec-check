/**
 * Word lists used by the rules. English only (limitation `english-lexicon`). Changing a list changes findings,
 * so every change needs a fixture update first (docs/SPEC.md, verification-first).
 */
/**
 * Placeholders that appear verbatim in GitHub Spec Kit 1.1.2 `templates/spec-template.md` (commit 959e866).
 * Exact strings; entries ending in a space or comma are prefixes of longer bracketed placeholders.
 */
export declare const SPEC_KIT_PLACEHOLDERS_EXACT: string[];
/** Prefixes of longer Spec Kit 1.1.2 placeholders (matched as `[` + prefix … `]`). */
export declare const SPEC_KIT_PLACEHOLDER_PREFIXES: string[];
/** Unresolved-work markers (case-sensitive). */
export declare const OPEN_MARKER: RegExp;
/** Terms that usually need a measurable definition (matched as whole words, case-insensitive). */
export declare const VAGUE_TERMS: string[];
/** True when the text contains a number (digit, number word or percentage). */
export declare function hasNumber(text: string): boolean;
/** True when the text has a number or a universal quantifier (criteria can be measurable without numbers). */
export declare function hasMeasure(text: string): boolean;
/** Wording that indicates a negative, error or boundary case. */
export declare const NEGATIVE_WORDING: RegExp;
/** Wording that indicates a non-functional quality (performance, security, accessibility, …). */
export declare const NON_FUNCTIONAL_WORDING: RegExp;
/** Builds a whole-word matcher for a list of vague terms. */
export declare function vagueMatcher(terms: readonly string[]): RegExp;
/** Service-level qualities that call for a target (design-package profile, `nfr-without-slo`). */
export declare const SERVICE_LEVEL: RegExp;
/** A percentile or a percentage. */
export declare const PERCENT_OR_PERCENTILE: RegExp;
/** A measurement window ("over 28 days", "per calendar month", "30-day", "30d", "monthly"). "Within" is a target. */
export declare const WINDOW: RegExp;
/** Words that name a measured indicator (`slo-without-sli`). */
export declare const INDICATOR: RegExp;
/** Vocabulary that suggests an AI component (`ai-governance-missing`). */
export declare const AI_VOCABULARY: RegExp;
