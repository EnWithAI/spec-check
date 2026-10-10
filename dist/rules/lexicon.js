// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Word lists used by the rules. English only (limitation `english-lexicon`). Changing a list changes findings,
 * so every change needs a fixture update first (docs/SPEC.md, verification-first).
 */
/**
 * Placeholders that appear verbatim in GitHub Spec Kit 1.1.2 `templates/spec-template.md` (commit 959e866).
 * Exact strings; entries ending in a space or comma are prefixes of longer bracketed placeholders.
 */
export const SPEC_KIT_PLACEHOLDERS_EXACT = [
    "[FEATURE NAME]",
    "[###-feature-name]",
    "[DATE]",
    "$ARGUMENTS",
    "[Brief Title]",
    "[initial state]",
    "[action]",
    "[expected outcome]",
    "[boundary condition]",
    "[error scenario]",
    "[Entity 1]",
    "[Entity 2]",
];
/** Prefixes of longer Spec Kit 1.1.2 placeholders (matched as `[` + prefix … `]`). */
export const SPEC_KIT_PLACEHOLDER_PREFIXES = [
    "Describe ",
    "Explain the value",
    "Add more user stories",
    "specific capability",
    "key interaction",
    "data requirement",
    "behavior, e.g.",
    "What it represents",
    "Measurable metric",
    "User satisfaction metric",
    "Business metric",
    "Assumption about",
    "Dependency on existing system",
];
/** Unresolved-work markers (case-sensitive). */
export const OPEN_MARKER = /\b(TBD|TODO|FIXME|XXX)\b|\?\?\?/g;
/** Terms that usually need a measurable definition (matched as whole words, case-insensitive). */
export const VAGUE_TERMS = [
    "quick",
    "quickly",
    "fast",
    "faster",
    "slow",
    "rapid",
    "rapidly",
    "responsive",
    "efficient",
    "efficiently",
    "user-friendly",
    "user friendly",
    "intuitive",
    "easy",
    "easily",
    "seamless",
    "seamlessly",
    "robust",
    "scalable",
    "flexible",
    "adequate",
    "adequately",
    "appropriate",
    "appropriately",
    "as needed",
    "if possible",
    "where possible",
    "when possible",
    "as soon as possible",
    "asap",
    "reasonable",
    "reasonably",
    "sufficient",
    "sufficiently",
    "optimal",
    "optimally",
    "minimal",
    "significant",
    "significantly",
    "etc",
    "and/or",
    "best effort",
    "state-of-the-art",
    "high-quality",
    "timely",
    "lightweight",
];
/** Number words counted as a numeric measure. */
const NUMBER_WORDS = "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million|billion|once|twice|half|double|triple";
/** True when the text contains a number (digit, number word or percentage). */
export function hasNumber(text) {
    return /\d/.test(text) || new RegExp(`\\b(${NUMBER_WORDS})\\b`, "i").test(text);
}
/** True when the text has a number or a universal quantifier (criteria can be measurable without numbers). */
export function hasMeasure(text) {
    return hasNumber(text) || /\b(all|every|each|none|no|never|always|only)\b/i.test(text);
}
/** Wording that indicates a negative, error or boundary case. */
export const NEGATIVE_WORDING = /\b(invalid|errors?|fail|fails|failed|failure|failures|reject|rejects|rejected|deny|denies|denied|unauthori[sz]ed|forbidden|timeouts?|timed out|expire[sd]?|missing|empty|exceeds?|exceeded|not found|duplicates?|conflicts?|cannot|can't|unavailable|retry|retried|retries|locked|oversized|unknown)\b/i;
/** Wording that indicates a non-functional quality (performance, security, accessibility, …). */
export const NON_FUNCTIONAL_WORDING = new RegExp([
    "\\b(performance|latency|response time|throughput|p\\d{2}|percentile|availability|uptime|reliability|security|secure|encrypt\\w*|privacy|personal data|gdpr|authori[sz]\\w*|authenticat\\w*|accessib\\w*|wcag|retention|retain\\w*|audit\\w*|scalability|concurrent|localization|locali[sz]ed|i18n|compliance|backup|recovery|rto|rpo)\\b",
    "\\b(within|under|below|less than|at most)\\s+\\d+(?:[.,]\\d+)?\\s*(ms|milliseconds?|s|secs?|seconds?|minutes?|hours?)\\b",
].join("|"), "i");
/** Builds a whole-word matcher for a list of vague terms. */
export function vagueMatcher(terms) {
    const escaped = [...terms]
        .sort((a, b) => b.length - a.length)
        .map((t) => t.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/ /g, "\\s+"));
    return new RegExp(`(?<![\\w-])(${escaped.join("|")})(?![\\w-])`, "gi");
}
