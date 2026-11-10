/**
 * Spec model built from Markdown blocks: requirement items (ID-defined or, in generic Markdown, MUST/SHALL items
 * under a "requirements" heading), ID definitions and references, Given/When/Then scenarios, Gherkin scenarios
 * and Spec Kit user stories. Pure and deterministic.
 */
import type { InputFormat, RequirementKind } from "../types.js";
import { type Block, type MarkdownDoc } from "./markdown.js";
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
export declare function idPattern(prefixes: readonly string[]): RegExp;
/** Builds the spec model for one file. */
export declare function buildSpec(path: string, text: string, idPrefixes: Record<string, RequirementKind>): SpecDoc;
