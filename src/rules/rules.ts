/**
 * Rule catalog and rule evaluation (docs/SPEC.md §5). Rules return raw findings with locations; the analyzer
 * assigns IDs, applies suppressions and sorts. Every rule is either a structural fact (verified_static_fact) or a
 * lexical judgement (hypothesis) and says so.
 */
import type { Config } from "../config.js";
import type { Block } from "../parse/markdown.js";
import { stripCodeSpans } from "../parse/markdown.js";
import type { SpecDoc, SpecItem } from "../parse/spec.js";
import type { Category, Confidence, Severity, Status } from "../types.js";
import {
  hasMeasure,
  hasNumber,
  NEGATIVE_WORDING,
  NON_FUNCTIONAL_WORDING,
  OPEN_MARKER,
  SPEC_KIT_PLACEHOLDER_PREFIXES,
  SPEC_KIT_PLACEHOLDERS_EXACT,
  VAGUE_TERMS,
  vagueMatcher,
} from "./lexicon.js";

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
export const RULES: Record<string, RuleInfo> = {
  "needs-clarification": {
    id: "needs-clarification",
    category: "clarity",
    status: "verified_static_fact",
    severity: "high",
    confidence: "high",
    title: "Unresolved [NEEDS CLARIFICATION] marker",
    explanation: "The spec itself marks this point as unresolved; building from it means guessing.",
    action: "Resolve the question with the requirement owner and replace the marker with the decision.",
  },
  "template-placeholder": {
    id: "template-placeholder",
    category: "clarity",
    status: "verified_static_fact",
    severity: "high",
    confidence: "high",
    title: "Template placeholder left in the spec",
    explanation: "Placeholder text from the spec template was not replaced with real content.",
    action: "Replace the placeholder with the actual content or delete the line.",
  },
  "open-marker": {
    id: "open-marker",
    category: "clarity",
    status: "verified_static_fact",
    severity: "medium",
    confidence: "high",
    title: "TBD/TODO marker in a requirement, criterion or scenario",
    explanation: "The text says it is unfinished.",
    action: "Finish the statement or move the open point to a tracked question.",
  },
  "vague-term": {
    id: "vague-term",
    category: "clarity",
    status: "hypothesis",
    severity: "low",
    confidence: "medium",
    title: "Vague term without a measure",
    explanation: "A term such as 'fast' or 'user-friendly' is used without a number that makes it testable.",
    action:
      "Add a measurable threshold (for example a latency, count or percentage) or confirm the wording is intended.",
  },
  "unmeasurable-criterion": {
    id: "unmeasurable-criterion",
    category: "verifiability",
    status: "hypothesis",
    severity: "medium",
    confidence: "medium",
    title: "Success criterion without a measure",
    explanation:
      "The criterion has no number, threshold or universal quantifier, so success cannot be checked.",
    action: "State how success is measured: a target value, a percentage or an all/none condition.",
  },
  "scenario-incomplete": {
    id: "scenario-incomplete",
    category: "verifiability",
    status: "verified_static_fact",
    severity: "medium",
    confidence: "high",
    title: "Scenario missing Given, When or Then",
    explanation:
      "An acceptance scenario lacks a precondition, an action or an expected outcome, or has them out of order.",
    action: "Complete the scenario so it states the starting state, the action and the observable outcome.",
  },
  "story-without-scenarios": {
    id: "story-without-scenarios",
    category: "verifiability",
    status: "verified_static_fact",
    severity: "medium",
    confidence: "high",
    title: "User story without acceptance scenarios",
    explanation: "Nothing in the story's section says how to verify it.",
    action: "Add at least one Given/When/Then acceptance scenario to the story.",
  },
  "missing-edge-cases": {
    id: "missing-edge-cases",
    category: "coverage",
    status: "hypothesis",
    severity: "medium",
    confidence: "low",
    title: "No edge or negative cases",
    explanation:
      "The file has requirements but no edge-case section with content and no error, rejection or boundary wording.",
    action:
      "Describe what happens on invalid input, failure, limits and empty states, or confirm none apply.",
  },
  "missing-non-functional": {
    id: "missing-non-functional",
    category: "coverage",
    status: "hypothesis",
    severity: "info",
    confidence: "low",
    title: "No non-functional constraint mentioned",
    explanation: "Nothing mentions performance, security, privacy, accessibility, reliability or retention.",
    action: "State the quality constraints that matter for this feature, or confirm none apply.",
  },
  "duplicate-id": {
    id: "duplicate-id",
    category: "integrity",
    status: "verified_static_fact",
    severity: "high",
    confidence: "high",
    title: "Requirement ID defined more than once",
    explanation: "Two definitions share one ID, so references to it are ambiguous.",
    action: "Give each requirement a unique ID and update references.",
  },
  "dangling-reference": {
    id: "dangling-reference",
    category: "integrity",
    status: "verified_static_fact",
    severity: "medium",
    confidence: "high",
    title: "Reference to an undefined ID",
    explanation: "The ID is mentioned but defined in none of the analyzed files.",
    action: "Define the referenced requirement, fix the ID, or include the file that defines it in the run.",
  },
  "missing-owner": {
    id: "missing-owner",
    category: "ownership",
    status: "verified_static_fact",
    severity: "low",
    confidence: "high",
    title: "No owner recorded",
    explanation:
      "Neither an `owner` front-matter key nor an **Owner**: line names who decides open questions.",
    action: "Add `owner:` front matter or an **Owner**: line.",
  },
};

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

/** Requirement item whose block contains a line, if any. */
function itemAt(doc: SpecDoc, line: number): SpecItem | undefined {
  return doc.items.find((i) => line >= i.block.lineStart && line <= i.block.lineEnd);
}

/** Quote helper for summaries (rendering escapes it later). */
const q = (s: string): string => `"${s}"`;

/** Lines of non-heading and heading blocks, comments and fences already removed. */
function allLines(doc: SpecDoc): { line: number; text: string; block: Block }[] {
  return doc.md.blocks.flatMap((block) => block.lines.map((l) => ({ ...l, block })));
}

/** `[NEEDS CLARIFICATION…]` markers outside code. */
function needsClarification(doc: SpecDoc): RawFinding[] {
  const out: RawFinding[] = [];
  for (const { line, text } of allLines(doc)) {
    const markers = [...stripCodeSpans(text).matchAll(/\[NEEDS CLARIFICATION\b[^\]]*\]/gi)];
    if (markers.length === 0) continue;
    const item = itemAt(doc, line);
    out.push({
      rule: "needs-clarification",
      summary: `${markers.length === 1 ? "Unresolved clarification" : `${markers.length} unresolved clarifications`}${item?.id ? ` in ${item.id}` : ""}`,
      path: doc.path,
      locations: [{ lineStart: line, lineEnd: line, detail: "NEEDS CLARIFICATION", excerptLine: line }],
      requirementIds: item?.id ? [item.id] : [],
      key: markers.map((m) => m[0]).join("|"),
    });
  }
  return out;
}

/** Spec Kit template placeholders (exact = verified) and generic bracketed placeholders (hypothesis). */
function placeholders(doc: SpecDoc): RawFinding[] {
  const out: RawFinding[] = [];
  const referenceLabels = new Set<string>();
  for (const { text } of allLines(doc)) {
    const def = /^\s*\[([^\]]+)\]:\s/.exec(text);
    if (def) referenceLabels.add((def[1] as string).toLowerCase());
  }
  for (const { line, text } of allLines(doc)) {
    const exact = SPEC_KIT_PLACEHOLDERS_EXACT.filter((p) => text.includes(p));
    for (const m of text.matchAll(/\[([^\]\n]+)\]/g)) {
      const inner = m[1] as string;
      if (SPEC_KIT_PLACEHOLDER_PREFIXES.some((p) => inner.startsWith(p))) exact.push(m[0]);
    }
    const item = itemAt(doc, line);
    if (exact.length > 0) {
      out.push({
        rule: "template-placeholder",
        summary: `Template placeholder ${exact.map(q).join(", ")} not replaced`,
        path: doc.path,
        locations: [{ lineStart: line, lineEnd: line, detail: exact.join(" "), excerptLine: line }],
        requirementIds: item?.id ? [item.id] : [],
        key: exact.join("|"),
      });
      continue;
    }
    const generic: string[] = [];
    const code = stripCodeSpans(text);
    for (const m of code.matchAll(/(?<![!\]\\])\[([^\][\n]{3,80})\](?![([:])/g)) {
      const inner = (m[1] as string).trim();
      if (/^(x|X| )$/.test(inner) || inner.startsWith("^") || inner.startsWith("!")) continue;
      if (/^NEEDS CLARIFICATION/i.test(inner)) continue;
      if (referenceLabels.has(inner.toLowerCase())) continue;
      if (!/[A-Za-z]/.test(inner)) continue;
      if (!/\s/.test(inner) && !/^[A-Z][A-Z ]{2,}$/.test(inner)) continue;
      generic.push(m[0]);
    }
    if (generic.length > 0) {
      out.push({
        rule: "template-placeholder",
        status: "hypothesis",
        severity: "medium",
        confidence: "medium",
        summary: `Possible placeholder ${generic.map(q).join(", ")}`,
        path: doc.path,
        locations: [{ lineStart: line, lineEnd: line, detail: generic.join(" "), excerptLine: line }],
        requirementIds: item?.id ? [item.id] : [],
        key: generic.join("|"),
      });
    }
  }
  return out;
}

/** Blocks the clarity rules inspect: requirement items and scenarios. */
function inspectedBlocks(doc: SpecDoc): { block: Block; item: SpecItem | undefined }[] {
  const seen = new Set<Block>();
  const out: { block: Block; item: SpecItem | undefined }[] = [];
  for (const item of doc.items) {
    seen.add(item.block);
    out.push({ block: item.block, item });
  }
  for (const s of doc.scenarios) {
    if (s.gherkin) continue;
    const block = doc.md.blocks.find((b) => b.lineStart === s.lineStart && b.type !== "heading");
    if (block && !seen.has(block)) {
      seen.add(block);
      out.push({ block, item: undefined });
    }
  }
  return out;
}

/** TBD/TODO/FIXME markers in requirements, criteria and scenarios. */
function openMarkers(doc: SpecDoc): RawFinding[] {
  const out: RawFinding[] = [];
  for (const { block, item } of inspectedBlocks(doc)) {
    for (const { line, text } of block.lines) {
      const markers = [...stripCodeSpans(text).matchAll(OPEN_MARKER)].map((m) => m[0]);
      if (markers.length === 0) continue;
      out.push({
        rule: "open-marker",
        summary: `${[...new Set(markers)].join(", ")} marker${item?.id ? ` in ${item.id}` : ""}`,
        path: doc.path,
        locations: [
          { lineStart: line, lineEnd: line, detail: [...new Set(markers)].join(" "), excerptLine: line },
        ],
        requirementIds: item?.id ? [item.id] : [],
        key: markers.join("|"),
      });
    }
  }
  return out;
}

/** Vague terms in requirements and scenarios that carry no number. */
function vagueTerms(doc: SpecDoc, config: Config): RawFinding[] {
  const terms = [...new Set([...VAGUE_TERMS, ...config.vagueTermsAdd])].filter(
    (t) => !config.vagueTermsRemove.includes(t)
  );
  if (terms.length === 0) return [];
  const re = vagueMatcher(terms);
  const out: RawFinding[] = [];
  for (const { block, item } of inspectedBlocks(doc)) {
    if (item?.kind === "success_criterion") continue; // covered by unmeasurable-criterion
    const text = stripCodeSpans(item ? item.body : block.text);
    if (hasNumber(text.replace(/\b[A-Z]{1,10}-\d{1,5}\b/g, " "))) continue;
    const found = [
      ...new Set([...text.matchAll(re)].map((m) => (m[1] as string).toLowerCase().replace(/\s+/g, " "))),
    ].sort();
    if (found.length === 0) continue;
    const single = new RegExp(re.source, "i");
    const line = block.lines.find((l) => single.test(stripCodeSpans(l.text)))?.line ?? block.lineStart;
    out.push({
      rule: "vague-term",
      summary: `Vague ${found.length === 1 ? "term" : "terms"} ${found.map(q).join(", ")} without a measure${item?.id ? ` in ${item.id}` : ""}`,
      path: doc.path,
      locations: [
        { lineStart: block.lineStart, lineEnd: block.lineEnd, detail: found.join(", "), excerptLine: line },
      ],
      requirementIds: item?.id ? [item.id] : [],
      key: found.join("|"),
    });
  }
  return out;
}

/** Success criteria without a number or universal quantifier. */
function unmeasurableCriteria(doc: SpecDoc): RawFinding[] {
  return doc.items
    .filter((i) => i.kind === "success_criterion" && !hasMeasure(i.body))
    .map((i) => ({
      rule: "unmeasurable-criterion",
      summary: `${i.id ?? "Success criterion"} has no measurable target`,
      path: doc.path,
      locations: [
        {
          lineStart: i.block.lineStart,
          lineEnd: i.block.lineEnd,
          detail: i.id ?? "criterion",
          excerptLine: i.block.lineStart,
        },
      ],
      requirementIds: i.id ? [i.id] : [],
      key: i.body,
    }));
}

/** Scenarios missing Given/When/Then or with them out of order. */
function incompleteScenarios(doc: SpecDoc): RawFinding[] {
  const out: RawFinding[] = [];
  for (const s of doc.scenarios) {
    const first = (["Given", "When", "Then"] as const).map((k) => s.keywords.indexOf(k));
    const missing = (["Given", "When", "Then"] as const).filter((_, i) => first[i] === -1);
    const ordered =
      missing.length === 0 &&
      (first[0] as number) < (first[1] as number) &&
      (first[1] as number) < (first[2] as number);
    if (missing.length === 0 && ordered) continue;
    const problem = missing.length > 0 ? `missing ${missing.join(", ")}` : "Given/When/Then out of order";
    const item = itemAt(doc, s.lineStart);
    out.push({
      rule: "scenario-incomplete",
      summary: `${s.gherkin ? "Gherkin scenario" : "Scenario"} ${problem}`,
      path: doc.path,
      locations: [{ lineStart: s.lineStart, lineEnd: s.lineEnd, detail: problem, excerptLine: s.lineStart }],
      requirementIds: item?.id ? [item.id] : [],
      key: `${problem}|${s.text}`,
    });
  }
  return out;
}

/** Spec Kit user stories without any scenario in their section. */
function storiesWithoutScenarios(doc: SpecDoc): RawFinding[] {
  return doc.stories
    .filter((story) => !doc.scenarios.some((s) => s.lineStart > story.line && s.lineStart <= story.endLine))
    .map((story) => ({
      rule: "story-without-scenarios",
      summary: "User story has no acceptance scenario",
      path: doc.path,
      locations: [
        { lineStart: story.line, lineEnd: story.line, detail: "user story", excerptLine: story.line },
      ],
      requirementIds: [],
      key: story.title,
    }));
}

/** True when a block's text is only placeholders or empty after removing them. */
function isPlaceholderOnly(text: string): boolean {
  return (
    stripCodeSpans(text)
      .replace(/\[[^\]]*\]/g, "")
      .replace(/[\s.?!:,*_-]/g, "").length === 0
  );
}

/** Files with requirements but neither edge-case content nor negative wording. */
function missingEdgeCases(doc: SpecDoc): RawFinding[] {
  if (doc.items.length === 0) return [];
  const edgeContent = doc.md.blocks.some(
    (b) =>
      b.type !== "heading" &&
      b.headings.some((h) => /edge cases?|negative (cases|scenarios)|error (cases|handling)/i.test(h)) &&
      !isPlaceholderOnly(b.text)
  );
  if (edgeContent) return [];
  const texts = [
    ...doc.items.map((i) => i.body),
    ...doc.scenarios.map((s) => s.text),
    ...doc.md.gherkin.flatMap((g) => g.lines.map((l) => l.text)),
  ];
  if (texts.some((t) => NEGATIVE_WORDING.test(stripCodeSpans(t).replace(/\[[^\]]*\]/g, " ")))) return [];
  return [
    {
      rule: "missing-edge-cases",
      summary: "No edge cases or negative scenarios found",
      path: doc.path,
      locations: [
        { lineStart: doc.anchorLine, lineEnd: doc.anchorLine, detail: "document", excerptLine: null },
      ],
      requirementIds: [],
      key: "document",
    },
  ];
}

/** Files with requirements that never mention a non-functional quality. */
function missingNonFunctional(doc: SpecDoc): RawFinding[] {
  if (doc.items.length === 0) return [];
  if (doc.items.some((i) => i.kind === "non_functional")) return [];
  const text = doc.md.blocks.map((b) => stripCodeSpans(b.text)).join("\n");
  if (NON_FUNCTIONAL_WORDING.test(text)) return [];
  return [
    {
      rule: "missing-non-functional",
      summary: "No non-functional constraint (performance, security, accessibility, …) mentioned",
      path: doc.path,
      locations: [
        { lineStart: doc.anchorLine, lineEnd: doc.anchorLine, detail: "document", excerptLine: null },
      ],
      requirementIds: [],
      key: "document",
    },
  ];
}

/** Owner recorded in front matter or an **Owner**: line (only when required by config). */
function missingOwner(doc: SpecDoc, config: Config): RawFinding[] {
  if (!config.requireOwner) return [];
  if (doc.md.frontMatter?.values.owner?.value) return [];
  if (doc.md.blocks.some((b) => /^(\*\*|__)?owners?(:(\*\*|__)|(\*\*|__)?\s*:)/i.test(b.text))) return [];
  return [
    {
      rule: "missing-owner",
      summary: "No owner recorded",
      path: doc.path,
      locations: [{ lineStart: 1, lineEnd: 1, detail: "document", excerptLine: null }],
      requirementIds: [],
      key: "document",
    },
  ];
}

/** Per-file rules. */
export function fileRules(doc: SpecDoc, config: Config): RawFinding[] {
  return [
    ...needsClarification(doc),
    ...placeholders(doc),
    ...openMarkers(doc),
    ...vagueTerms(doc, config),
    ...unmeasurableCriteria(doc),
    ...incompleteScenarios(doc),
    ...storiesWithoutScenarios(doc),
    ...missingEdgeCases(doc),
    ...missingNonFunctional(doc),
    ...missingOwner(doc, config),
  ];
}

/**
 * Integrity rules. Duplicates are counted per file (`id_scope: "file"`, the default: Spec Kit numbers FR-001 per
 * feature) or across the whole input set (`"set"`). References resolve against every analyzed file in both modes.
 */
export function setRules(docs: SpecDoc[], idScope: Config["idScope"]): RawFinding[] {
  const out: RawFinding[] = [];
  const defs = new Map<string, { id: string; path: string; line: number }[]>();
  const defined = new Set<string>();
  for (const doc of docs)
    for (const d of doc.definitions) {
      const key = idScope === "file" ? `${doc.path}\0${d.id}` : d.id;
      const list = defs.get(key) ?? [];
      list.push({ id: d.id, path: doc.path, line: d.line });
      defs.set(key, list);
      defined.add(d.id);
    }
  for (const list of defs.values()) {
    const id = (list[0] as { id: string }).id;
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => (a.path === b.path ? a.line - b.line : a.path < b.path ? -1 : 1));
    out.push({
      rule: "duplicate-id",
      summary: `${id} is defined ${list.length} times`,
      path: (sorted[0] as { path: string }).path,
      locations: sorted.map((d) => ({
        path: d.path,
        lineStart: d.line,
        lineEnd: d.line,
        detail: id,
        excerptLine: d.line,
      })),
      requirementIds: [id],
      key: id,
    });
  }
  for (const doc of docs) {
    const seen = new Set<string>();
    for (const ref of doc.references) {
      if (defined.has(ref.id) || seen.has(`${ref.id}@${ref.line}`)) continue;
      seen.add(`${ref.id}@${ref.line}`);
      const item = itemAt(doc, ref.line);
      out.push({
        rule: "dangling-reference",
        summary: `${ref.id} is referenced but not defined`,
        path: doc.path,
        locations: [{ lineStart: ref.line, lineEnd: ref.line, detail: ref.id, excerptLine: ref.line }],
        requirementIds: item?.id ? [item.id] : [],
        key: ref.id,
      });
    }
  }
  return out;
}
