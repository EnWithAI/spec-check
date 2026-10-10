/**
 * Line-based Markdown model (docs/SPEC.md §3): front matter, ATX headings, list items with continuation lines,
 * paragraphs, fenced code (kept only for Gherkin), HTML comments (removed, except suppression directives).
 * Deliberately a subset: setext headings and HTML blocks are reported as a `markdown-subset` limitation.
 */
/** A structural block with 1-based line numbers. */
export interface Block {
    type: "heading" | "item" | "paragraph";
    /** Heading level (1–6) for headings, 0 otherwise. */
    level: number;
    /** Text with comments removed and lines joined by a single space. Markers (`-`, `1.`, `#`) stripped. */
    text: string;
    lineStart: number;
    lineEnd: number;
    /** Per-line text (comments removed), aligned with lineStart..lineEnd. */
    lines: {
        line: number;
        text: string;
    }[];
    /** Titles of enclosing headings, outermost first (for headings: excluding itself). */
    headings: string[];
}
/** A Gherkin fenced block. */
export interface GherkinBlock {
    lineStart: number;
    lines: {
        line: number;
        text: string;
    }[];
}
/** A `spec-check-disable-next-line` directive and the line it applies to. */
export interface Directive {
    line: number;
    target: number;
    rules: string[];
}
/** Parsed front matter (flat `key: value` subset). */
export interface FrontMatter {
    values: Record<string, {
        value: string;
        line: number;
    }>;
    unsupportedLines: number;
}
/** A parsed Markdown document. */
export interface MarkdownDoc {
    lineCount: number;
    frontMatter: FrontMatter | null;
    blocks: Block[];
    gherkin: GherkinBlock[];
    directives: Directive[];
    /** True when constructs outside the supported subset were seen. */
    outsideSubset: boolean;
}
/** Parses Markdown text into blocks. Pure and deterministic. */
export declare function parseMarkdown(source: string): MarkdownDoc;
/** Replaces inline code spans with spaces (heuristic rules ignore code). */
export declare function stripCodeSpans(text: string): string;
/** Removes emphasis markers (`*`, `_`) used around keywords such as **Given**. */
export declare function stripEmphasis(text: string): string;
