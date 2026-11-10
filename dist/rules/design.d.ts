import { type Config } from "../config.js";
import type { SpecDoc } from "../parse/spec.js";
import type { RawFinding } from "./rules.js";
/** Inputs the design rules need beyond the parsed files. */
export interface DesignContext {
    /** Files under cwd (for required documents); null when not listed. */
    files: string[] | null;
    /** Display path of the config file that enabled the profile (evidence for required documents). */
    configPath: string;
}
/** True when the path matches the ADR globs and the file name starts with a number. */
export declare function isAdr(path: string, config: Config): boolean;
/** All design-package findings (only called when the profile is enabled). */
export declare function designRules(docs: SpecDoc[], config: Config, ctx: DesignContext): RawFinding[];
