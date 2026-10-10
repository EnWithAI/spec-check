// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Spec model built from Markdown blocks: requirement items (ID-defined or, in generic Markdown, MUST/SHALL items
 * under a "requirements" heading), ID definitions and references, Given/When/Then scenarios, Gherkin scenarios
 * and Spec Kit user stories. Pure and deterministic.
 */
import type { InputFormat, RequirementKind } from "../types.js";
import { parseMarkdown, stripCodeSpans, stripEmphasis, type Block, type MarkdownDoc } from "./markdown.js";

/** A requirement or success criterion item. */
export interface SpecItem {
  id: string | null;
  kind: RequirementKind;
  block: Block;
  /** Item text after the ID prefix, code spans removed. */
  body: string;
  references: string[];
}

/** A scenario (Given/When/Then line or Gherkin scenario). */
export interface Scenario {
  lineStart: number;
  lineEnd: number;
  /** Keywords in order of appearance (Given/When/Then only; And/But continue the previous one). */
  keywords: ("Given" | "When" | "Then")[];
  text: string;
  gherkin: boolean;
}

/** A Spec Kit user story section. */
export interface Story {
  line: number;
  title: string;
  /** Last line of the story's section. */
  endLine: number;
}

/** An ID occurrence (definition or reference). */
export interface IdOccurrence {
  id: string;
  line: number;
  block: Block;
}

/** Everything the rules need about one file. */
export interface SpecDoc {
  path: string;
  format: InputFormat;
  md: MarkdownDoc;
  items: SpecItem[];
  definitions: IdOccurrence[];
  references: IdOccurrence[];
  scenarios: Scenario[];
  stories: Story[];
  /** Line of the "Requirements" heading, else the first requirement, else 1 (document-level evidence). */
  anchorLine: number;
}

/** Builds the ID regex for the configured prefixes. */
export function idPattern(prefixes: readonly string[]): RegExp {
  const sorted = [...prefixes].sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![A-Za-z0-9_-])(?:${sorted.join("|")})-\\d{1,5}(?![A-Za-z0-9_-])`, "g");
}

/** Returns the defined ID when the text starts with `ID:` / `**ID**:` / `**ID:**`. */
function definedId(text: string, prefixes: readonly string[]): string | null {
  const plain = text.replace(/^\s*(\*\*|__)?/, "");
  const m = new RegExp(
    `^(${[...prefixes].sort((a, b) => b.length - a.length).join("|")})-(\\d{1,5})(?:\\*\\*|__)?\\s*[:.–—-]`
  ).exec(plain);
  return m ? `${m[1] as string}-${m[2] as string}` : null;
}

/** Text after the leading ID and emphasis. */
function bodyAfterId(text: string): string {
  return text.replace(/^\s*(\*\*|__)?[A-Z]+-\d{1,5}(\*\*|__)?\s*[:.–—-]?\s*(\*\*|__)?\s*/, "");
}

const SCENARIO_START = /^Given\b/;
const BOLD_KEYWORD = /(\*\*|__)(Given|When|Then)(\*\*|__)/;

/**
 * Keywords of a single-line scenario, or null if the block is not one. A block is a scenario when it starts with
 * "Given" or contains a bold Given, When or Then keyword. Keywords are matched case-insensitively and returned in
 * order of their first occurrence.
 */
function scenarioKeywords(text: string): ("Given" | "When" | "Then")[] | null {
  const code = stripCodeSpans(text);
  const plain = stripEmphasis(code).trim();
  if (!SCENARIO_START.test(plain) && !BOLD_KEYWORD.test(code)) return null;
  const first: { keyword: "Given" | "When" | "Then"; index: number }[] = [];
  for (const keyword of ["Given", "When", "Then"] as const) {
    const m = new RegExp(`\\b${keyword}\\b`, "i").exec(plain);
    if (m) first.push({ keyword, index: m.index });
  }
  return first.sort((a, b) => a.index - b.index).map((f) => f.keyword);
}

/** Parses Gherkin scenarios from fenced blocks. */
function gherkinScenarios(md: MarkdownDoc): Scenario[] {
  const out: Scenario[] = [];
  for (const block of md.gherkin) {
    let current: Scenario | null = null;
    let background: ("Given" | "When" | "Then")[] = [];
    let inBackground = false;
    for (const { line, text } of block.lines) {
      const t = text.trim();
      if (/^(Scenario|Scenario Outline|Example|Scenario Template):/i.test(t)) {
        if (current) out.push(current);
        inBackground = false;
        current = { lineStart: line, lineEnd: line, keywords: [...background], text: t, gherkin: true };
        continue;
      }
      if (/^Background:/i.test(t)) {
        if (current) out.push(current);
        current = null;
        inBackground = true;
        background = [];
        continue;
      }
      if (/^(Feature|Rule|Examples):/i.test(t)) {
        if (current) out.push(current);
        current = null;
        inBackground = false;
        continue;
      }
      const step = /^(Given|When|Then|And|But|\*)\s/.exec(t);
      if (!step) continue;
      const keyword = step[1] as string;
      if (inBackground) {
        if (keyword === "Given" || keyword === "When" || keyword === "Then") background.push(keyword);
        continue;
      }
      if (!current) continue;
      if (keyword === "Given" || keyword === "When" || keyword === "Then") current.keywords.push(keyword);
      current.lineEnd = line;
    }
    if (current) out.push(current);
  }
  return out;
}

/** Builds the spec model for one file. */
export function buildSpec(path: string, text: string, idPrefixes: Record<string, RequirementKind>): SpecDoc {
  const md = parseMarkdown(text);
  const prefixes = Object.keys(idPrefixes);
  const idRe = idPattern(prefixes);
  const items: SpecItem[] = [];
  const definitions: IdOccurrence[] = [];
  const references: IdOccurrence[] = [];
  const scenarios: Scenario[] = [];
  const stories: Story[] = [];

  const headingBlocks = md.blocks.filter((b) => b.type === "heading");
  const isSpecKit =
    headingBlocks.some((h) =>
      /^(User Scenarios & Testing|Functional Requirements|Feature Specification:)/i.test(h.text)
    ) || /(^|\/)spec\.md$/.test(path);

  // Table rows are separate items: split paragraphs made only of `|` rows into one block per row.
  const blocks = md.blocks.flatMap((b) =>
    b.type === "paragraph" && b.lines.every((l) => l.text.trim().startsWith("|"))
      ? b.lines.map((l) => ({ ...b, text: l.text.trim(), lineStart: l.line, lineEnd: l.line, lines: [l] }))
      : [b]
  );
  for (const block of blocks) {
    // ID definitions in headings count as definitions (for reference checks) but not as items.
    if (block.type === "heading") {
      const id = definedId(block.text, prefixes);
      if (id) definitions.push({ id, line: block.lineStart, block });
      if (/^User Story\b/i.test(block.text))
        stories.push({ line: block.lineStart, title: block.text, endLine: block.lineStart });
      continue;
    }
    const tableId = /^\|\s*(?:\*\*|__)?([A-Z]{1,10}-\d{1,5})(?:\*\*|__)?\s*\|/.exec(block.text);
    const id =
      definedId(block.text, prefixes) ??
      (tableId && prefixes.some((p) => tableId[1]?.startsWith(`${p}-`)) ? (tableId[1] as string) : null);
    const ownLine = block.lineStart;
    let item: SpecItem | null = null;
    if (id) {
      const prefix = id.slice(0, id.indexOf("-"));
      const body = stripCodeSpans(
        tableId && !definedId(block.text, prefixes)
          ? block.text.replace(/^\|[^|]*\|/, "")
          : bodyAfterId(block.text)
      );
      item = { id, kind: idPrefixes[prefix] as RequirementKind, block, body, references: [] };
      definitions.push({ id, line: ownLine, block });
    } else if (
      block.type === "item" &&
      block.headings.some((h) => /requirement/i.test(h)) &&
      /\b(must|shall|should)\b/i.test(stripCodeSpans(block.text))
    ) {
      item = { id: null, kind: "functional", block, body: stripCodeSpans(block.text), references: [] };
    }
    // References: every ID mentioned outside code spans, except the item's own definition.
    for (const { line, text: lineText } of block.lines) {
      for (const m of stripCodeSpans(lineText).matchAll(idRe)) {
        if (item?.id === m[0] && line === ownLine && definedId(lineText, prefixes) === m[0]) continue;
        if (item?.id === m[0] && tableId && line === ownLine) continue;
        references.push({ id: m[0], line, block });
        if (item && m[0] !== item.id && !item.references.includes(m[0])) item.references.push(m[0]);
      }
    }
    if (item) {
      item.references.sort();
      items.push(item);
    }
    const keywords = scenarioKeywords(block.text);
    if (keywords) {
      scenarios.push({
        lineStart: block.lineStart,
        lineEnd: block.lineEnd,
        keywords,
        text: block.text,
        gherkin: false,
      });
    }
  }
  scenarios.push(...gherkinScenarios(md));
  scenarios.sort((a, b) => a.lineStart - b.lineStart);

  // Story sections end before the next heading of the same or a higher level.
  for (const story of stories) {
    const heading = headingBlocks.find((h) => h.lineStart === story.line) as Block;
    const next = headingBlocks.find((h) => h.lineStart > story.line && h.level <= heading.level);
    story.endLine = next ? next.lineStart - 1 : md.lineCount;
  }

  const requirementsHeading = headingBlocks.find((h) => /^requirements\b/i.test(h.text));
  const anchorLine = requirementsHeading?.lineStart ?? items[0]?.block.lineStart ?? 1;
  return {
    path,
    format: isSpecKit ? "spec-kit" : "markdown",
    md,
    items,
    definitions,
    references,
    scenarios,
    stories,
    anchorLine,
  };
}
