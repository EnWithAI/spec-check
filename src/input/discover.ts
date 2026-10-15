// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Input discovery and reading: resolves positional paths or include globs to Markdown files, never follows
 * symlinks, skips binary/non-UTF-8 and oversized files, and caps the file count. Every skip becomes a limitation.
 */
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { matchesAny } from "../config.js";
import { inputError } from "../errors.js";
import type { Limitation } from "../types.js";

/** Caps that keep runs bounded (each reported as a limitation when hit). */
export const LIMITS = { maxFiles: 1000, maxFileBytes: 2 * 1024 * 1024, maxDepth: 20 } as const;

/** A readable spec file. */
export interface SourceFile {
  /** Path relative to the working directory, with `/` separators. */
  path: string;
  text: string;
  sha256: string;
}

/** Discovery result: files to analyze plus limitations for everything skipped. */
export interface Discovered {
  files: SourceFile[];
  limitations: Limitation[];
}

const MARKDOWN = /\.(md|markdown)$/i;
const SKIP_DIRS = new Set(["node_modules", ".git"]);

/** Display path relative to cwd with forward slashes. */
function display(cwd: string, absolute: string): string {
  const rel = relative(cwd, absolute);
  return (rel === "" ? "." : rel).split(sep).join("/");
}

/** Collects limitation paths by code. */
class Skips {
  private readonly byCode = new Map<string, Set<string>>();
  add(code: string, path: string): void {
    const set = this.byCode.get(code) ?? new Set<string>();
    set.add(path);
    this.byCode.set(code, set);
  }
  toLimitations(): Limitation[] {
    const messages: Record<string, string> = {
      "symlink-skipped": "Symbolic links are never followed; these paths were skipped.",
      "binary-skipped": "Binary or non-UTF-8 files were skipped.",
      "too-large": `Files larger than ${LIMITS.maxFileBytes / 1024 / 1024} MiB were skipped.`,
      "file-cap": `Only the first ${LIMITS.maxFiles} files (sorted by path) were analyzed.`,
      "depth-cap": `Directories deeper than ${LIMITS.maxDepth} levels were not walked.`,
      unreadable: "These paths could not be read.",
    };
    return [...this.byCode.entries()].map(([code, paths]) => {
      const sorted = [...paths].sort();
      return { code, message: messages[code] ?? code, paths: sorted.slice(0, 50), count: sorted.length };
    });
  }
}

/** Walks a directory for Markdown files (sorted, no symlinks, skipping node_modules and .git). */
function walk(cwd: string, dir: string, depth: number, out: string[], skips: Skips): void {
  if (depth > LIMITS.maxDepth) {
    skips.add("depth-cap", display(cwd, dir));
    return;
  }
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    skips.add("unreadable", display(cwd, dir));
    return;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) {
      if (MARKDOWN.test(entry.name) || !entry.name.includes("."))
        skips.add("symlink-skipped", display(cwd, full));
    } else if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(cwd, full, depth + 1, out, skips);
    } else if (entry.isFile() && MARKDOWN.test(entry.name)) {
      out.push(full);
    }
  }
}

/** Reads one file as UTF-8 text, or records why it was skipped. */
function readText(cwd: string, absolute: string, skips: Skips): SourceFile | null {
  const path = display(cwd, absolute);
  let bytes: Buffer;
  try {
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      skips.add("symlink-skipped", path);
      return null;
    }
    if (stat.size > LIMITS.maxFileBytes) {
      skips.add("too-large", path);
      return null;
    }
    bytes = readFileSync(absolute);
  } catch {
    skips.add("unreadable", path);
    return null;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    skips.add("binary-skipped", path);
    return null;
  }
  if (text.includes("\0")) {
    skips.add("binary-skipped", path);
    return null;
  }
  return {
    path,
    text: text.replace(/^\ufeff/, ""),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

/**
 * Resolves inputs. Positional paths (files or directories) win; otherwise the include globs are matched under
 * cwd. Throws an input error (exit 3) when a named path does not exist or nothing is found.
 */
export function discover(cwd: string, paths: string[], include: string[], exclude: string[]): Discovered {
  const skips = new Skips();
  const candidates: string[] = [];
  if (paths.length > 0) {
    for (const p of paths) {
      const absolute = isAbsolute(p) ? p : resolve(cwd, p);
      let stat;
      try {
        stat = lstatSync(absolute);
      } catch {
        throw inputError(`Input not found: ${p}`, "Pass existing Markdown files or directories.");
      }
      if (stat.isSymbolicLink()) skips.add("symlink-skipped", display(cwd, absolute));
      else if (stat.isDirectory()) walk(cwd, absolute, 0, candidates, skips);
      else candidates.push(absolute);
    }
  } else {
    const all: string[] = [];
    walk(cwd, cwd, 0, all, skips);
    for (const file of all) if (matchesAny(display(cwd, file), include)) candidates.push(file);
  }

  const unique = [...new Set(candidates)]
    .filter((file) => !matchesAny(display(cwd, file), exclude))
    .sort((a, b) => (display(cwd, a) < display(cwd, b) ? -1 : 1));
  const capped = unique.slice(0, LIMITS.maxFiles);
  for (const file of unique.slice(LIMITS.maxFiles)) skips.add("file-cap", display(cwd, file));

  const files = capped.map((file) => readText(cwd, file, skips)).filter((f): f is SourceFile => f !== null);
  if (files.length === 0 && skips.toLimitations().length === 0) {
    throw inputError(
      paths.length > 0
        ? "No Markdown files found in the given paths."
        : `No spec files match ${include.join(", ")}.`,
      "Pass paths explicitly, e.g. `spec-check check docs/`, or set `include` in .spec-check.json."
    );
  }
  return { files, limitations: skips.toLimitations() };
}

/** Cap on directory entries listed for `design-package-incomplete` (limitation `file-list-cap`). */
export const MAX_LISTED_FILES = 20_000;

/**
 * Lists file paths under cwd (names only, nothing is read), sorted, without following symlinks and skipping
 * node_modules and .git. Used only by the design-package profile.
 */
export function listFiles(cwd: string): { paths: string[]; capped: boolean } {
  const out: string[] = [];
  let capped = false;
  const visit = (dir: string, depth: number): void => {
    if (depth > LIMITS.maxDepth || capped) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(full, depth + 1);
      } else if (entry.isFile()) {
        if (out.length >= MAX_LISTED_FILES) {
          capped = true;
          return;
        }
        out.push(display(cwd, full));
      }
    }
  };
  visit(cwd, 0);
  return { paths: out.sort(), capped };
}
