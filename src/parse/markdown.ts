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
  lines: { line: number; text: string }[];
  /** Titles of enclosing headings, outermost first (for headings: excluding itself). */
  headings: string[];
}

/** A Gherkin fenced block. */
export interface GherkinBlock {
  lineStart: number;
  lines: { line: number; text: string }[];
}

/** A `spec-check-disable-next-line` directive and the line it applies to. */
export interface Directive {
  line: number;
  target: number;
  rules: string[];
}

/** Parsed front matter (flat `key: value` subset). */
export interface FrontMatter {
  values: Record<string, { value: string; line: number }>;
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

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([A-Za-z0-9_-]*)/;
const HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const DIRECTIVE = /^\s*spec-check-disable-next-line\s+([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)*)\s*$/;

/** Parses front matter starting at line 1. Returns the parsed values and the index of the first body line. */
function frontMatter(lines: string[]): { fm: FrontMatter | null; bodyStart: number } {
  if (lines[0]?.trim() !== "---") return { fm: null, bodyStart: 0 };
  const end = lines.findIndex((l, i) => i > 0 && i < 200 && (l.trim() === "---" || l.trim() === "..."));
  if (end < 0) return { fm: null, bodyStart: 0 };
  const fm: FrontMatter = { values: {}, unsupportedLines: 0 };
  for (let i = 1; i < end; i++) {
    const line = lines[i] as string;
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*?)\s*$/.exec(line);
    if (m) fm.values[(m[1] as string).toLowerCase()] = { value: (m[2] as string).replace(/^["']|["']$/g, ""), line: i + 1 };
    else fm.unsupportedLines++;
  }
  return { fm, bodyStart: end + 1 };
}

/** Parses Markdown text into blocks. Pure and deterministic. */
export function parseMarkdown(source: string): MarkdownDoc {
  const lines = source.split(/\r?\n/);
  const { fm, bodyStart } = frontMatter(lines);
  const blocks: Block[] = [];
  const gherkin: GherkinBlock[] = [];
  const directives: Directive[] = [];
  const headingStack: { level: number; title: string }[] = [];
  let outsideSubset = false;

  // Pass 1: remove HTML comments (recording directives) and fenced code (keeping Gherkin fences).
  const clean: (string | null)[] = lines.map(() => null);
  let inComment = false;
  let fence: { marker: string; gherkin: GherkinBlock | null } | null = null;
  for (let i = bodyStart; i < lines.length; i++) {
    const raw = lines[i] as string;
    if (fence) {
      const close = new RegExp(`^ {0,3}${fence.marker[0] === "`" ? "`" : "~"}{${fence.marker.length},}\\s*$`);
      if (close.test(raw)) fence = null;
      else fence.gherkin?.lines.push({ line: i + 1, text: raw });
      continue;
    }
    let text = "";
    let rest = raw;
    while (rest.length > 0) {
      if (inComment) {
        const end = rest.indexOf("-->");
        if (end < 0) {
          rest = "";
        } else {
          rest = rest.slice(end + 3);
          inComment = false;
        }
      } else {
        const start = rest.indexOf("<!--");
        if (start < 0) {
          text += rest;
          rest = "";
        } else {
          text += rest.slice(0, start);
          const end = rest.indexOf("-->", start + 4);
          const body = end < 0 ? null : rest.slice(start + 4, end);
          const directive = body === null ? null : DIRECTIVE.exec(body);
          if (directive) {
            directives.push({
              line: i + 1,
              target: -1,
              rules: (directive[1] as string).split(",").map((r) => r.trim()),
            });
          }
          if (end < 0) {
            inComment = true;
            rest = "";
          } else rest = rest.slice(end + 3);
        }
      }
    }
    if (!inComment && text.trim() === "" && raw.includes("<!--")) {
      clean[i] = "";
      continue;
    }
    const open = FENCE.exec(text);
    if (open && text.trim() === raw.trim()) {
      const lang = (open[2] as string).toLowerCase();
      const g = lang === "gherkin" || lang === "feature" ? { lineStart: i + 1, lines: [] } : null;
      if (g) gherkin.push(g);
      fence = { marker: open[1] as string, gherkin: g };
      continue;
    }
    clean[i] = text;
  }

  // Resolve directive targets: the next non-blank, non-comment line.
  for (const d of directives) {
    for (let j = d.line; j < lines.length; j++) {
      const c = clean[j];
      if (c !== null && c !== undefined && c.trim() !== "") {
        d.target = j + 1;
        break;
      }
    }
  }

  // Pass 2: blocks.
  const titles = (): string[] => headingStack.map((h) => h.title);
  let current: Block | null = null;
  const flush = (): void => {
    if (current) {
      current.text = current.lines.map((l) => l.text.trim()).join(" ").trim();
      blocks.push(current);
      current = null;
    }
  };
  for (let i = bodyStart; i < lines.length; i++) {
    const text = clean[i];
    if (text === null || text === undefined) {
      // Fenced or commented line: ends paragraphs (fences) but comments inside items are transparent.
      if (!/^\s*$/.test(lines[i] as string) && !(lines[i] as string).includes("-->")) flush();
      continue;
    }
    if (text.trim() === "") {
      flush();
      continue;
    }
    const heading = HEADING.exec(text);
    if (heading) {
      flush();
      const level = (heading[1] as string).length;
      const title = (heading[2] ?? "").trim();
      while (headingStack.length > 0 && (headingStack[headingStack.length - 1] as { level: number }).level >= level)
        headingStack.pop();
      blocks.push({
        type: "heading",
        level,
        text: title,
        lineStart: i + 1,
        lineEnd: i + 1,
        lines: [{ line: i + 1, text: title }],
        headings: titles(),
      });
      headingStack.push({ level, title });
      continue;
    }
    if (/^ {0,3}(=+|-{2,})\s*$/.test(text) && current !== null && (current as Block).type === "paragraph") {
      outsideSubset = true; // setext heading underline
    }
    if (/^ {0,3}<(div|table|details|p|section|pre)\b/i.test(text)) outsideSubset = true;
    const item = ITEM.exec(text);
    if (item) {
      flush();
      current = {
        type: "item",
        level: 0,
        text: "",
        lineStart: i + 1,
        lineEnd: i + 1,
        lines: [{ line: i + 1, text: item[3] as string }],
        headings: titles(),
      };
      continue;
    }
    if (current) {
      (current as Block).lines.push({ line: i + 1, text });
      (current as Block).lineEnd = i + 1;
    } else {
      current = {
        type: "paragraph",
        level: 0,
        text: "",
        lineStart: i + 1,
        lineEnd: i + 1,
        lines: [{ line: i + 1, text }],
        headings: titles(),
      };
    }
  }
  flush();
  return { lineCount: lines.length, frontMatter: fm, blocks, gherkin, directives, outsideSubset };
}

/** Replaces inline code spans with spaces (heuristic rules ignore code). */
export function stripCodeSpans(text: string): string {
  return text.replace(/(`+)([\s\S]*?)\1/g, (m) => " ".repeat(m.length));
}

/** Removes emphasis markers (`*`, `_`) used around keywords such as **Given**. */
export function stripEmphasis(text: string): string {
  return text.replace(/(\*{1,3}|_{1,3})(?=\S)([^*_]*?\S)\1/g, "$2");
}
