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
const NUMBER_WORDS =
  "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million|billion|once|twice|half|double|triple";

/** True when the text contains a number (digit, number word or percentage). */
export function hasNumber(text: string): boolean {
  return /\d/.test(text) || new RegExp(`\\b(${NUMBER_WORDS})\\b`, "i").test(text);
}

/** True when the text has a number or a universal quantifier (criteria can be measurable without numbers). */
export function hasMeasure(text: string): boolean {
  return hasNumber(text) || /\b(all|every|each|none|no|never|always|only)\b/i.test(text);
}

/** Wording that indicates a negative, error or boundary case. */
export const NEGATIVE_WORDING =
  /\b(invalid|errors?|fail|fails|failed|failure|failures|reject|rejects|rejected|deny|denies|denied|unauthori[sz]ed|forbidden|timeouts?|timed out|expire[sd]?|missing|empty|exceeds?|exceeded|not found|duplicates?|conflicts?|cannot|can't|unavailable|retry|retried|retries|locked|oversized|unknown)\b/i;

/** Wording that indicates a non-functional quality (performance, security, accessibility, …). */
export const NON_FUNCTIONAL_WORDING = new RegExp(
  [
    "\\b(performance|latency|response time|throughput|p\\d{2}|percentile|availability|uptime|reliability|security|secure|encrypt\\w*|privacy|personal data|gdpr|authori[sz]\\w*|authenticat\\w*|accessib\\w*|wcag|retention|retain\\w*|audit\\w*|scalability|concurrent|localization|locali[sz]ed|i18n|compliance|backup|recovery|rto|rpo)\\b",
    "\\b(within|under|below|less than|at most)\\s+\\d+(?:[.,]\\d+)?\\s*(ms|milliseconds?|s|secs?|seconds?|minutes?|hours?)\\b",
  ].join("|"),
  "i"
);

/** Builds a whole-word matcher for a list of vague terms. */
export function vagueMatcher(terms: readonly string[]): RegExp {
  const escaped = [...terms]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/ /g, "\\s+"));
  return new RegExp(`(?<![\\w-])(${escaped.join("|")})(?![\\w-])`, "gi");
}

/** Service-level qualities that call for a target (design-package profile, `nfr-without-slo`). */
export const SERVICE_LEVEL =
  /\b(latency|latencies|response times?|availability|uptime|error rates?|throughput|durability|freshness|success rates?|p\d{2,3}(?:\.\d+)?|percentile)\b/i;

/** A percentile or a percentage. */
export const PERCENT_OR_PERCENTILE =
  /\d(?:[.,]\d+)?\s*%|\bper ?cent\b|\bp\d{2,3}(?:\.\d+)?\b|\bpercentile\b/i;

/** A measurement window ("over 28 days", "per calendar month", "30-day", "30d", "monthly"). "Within" is a target. */
export const WINDOW = new RegExp(
  [
    "\\b(over|per|across|rolling|in any)\\s+(?:(?:a|an|the|each|any|every|calendar|rolling|trailing)\\s+)*(?:\\d+[- ]?)?(?:minutes?|hours?|days?|weeks?|months?|quarters?|years?)\\b",
    "\\b\\d+-(?:minute|hour|day|week|month)\\b",
    "\\b\\d+[dw]\\b",
    "\\b(daily|weekly|monthly|quarterly|annually)\\b",
  ].join("|"),
  "i"
);

/** Words that name a measured indicator (`slo-without-sli`). */
export const INDICATOR = new RegExp(`${SERVICE_LEVEL.source}|\\b(SLIs?|indicators?|requests?)\\b`, "i");

/** Vocabulary that suggests an AI component (`ai-governance-missing`). */
export const AI_VOCABULARY =
  /\b(LLMs?|large language models?|generative AI|GenAI|machine[- ]learning|ML models?|AI models?|AI agents?|model inference|embeddings|RAG|retrieval[- ]augmented|fine[- ]tun(?:e|ed|ing)|foundation models?|chatbots?|system prompts?|prompt injection)\b/i;
