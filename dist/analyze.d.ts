import type { Config } from "./config.js";
import type { Report } from "./types.js";
/** Options for one analysis run. */
export interface AnalyzeOptions {
    cwd: string;
    paths: string[];
    config: Config;
    configSource: string;
    /** Apply the policy (check command). */
    policy: boolean;
    excerpts: boolean;
    now?: () => Date;
}
/** Maximum findings kept in a report (limitation `finding-cap`). */
export declare const MAX_FINDINGS = 5000;
/** Runs the full analysis and returns a report (pure apart from reading input files and the clock). */
export declare function analyze(options: AnalyzeOptions): Report;
