import type { Limitation } from "../types.js";
/** Caps that keep runs bounded (each reported as a limitation when hit). */
export declare const LIMITS: {
    readonly maxFiles: 1000;
    readonly maxFileBytes: number;
    readonly maxDepth: 20;
};
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
/**
 * Resolves inputs. Positional paths (files or directories) win; otherwise the include globs are matched under
 * cwd. Throws an input error (exit 3) when a named path does not exist or nothing is found.
 */
export declare function discover(cwd: string, paths: string[], include: string[], exclude: string[]): Discovered;
