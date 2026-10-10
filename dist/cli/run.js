// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Command-line interface: argument parsing (node:util parseArgs), commands (analyze, check, rules, schema),
 * configuration loading, output writing and the mapping of every error to a documented exit code.
 */
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { analyze } from "../analyze.js";
import { DEFAULT_CONFIG, loadConfigFile } from "../config.js";
import { ExitCode, SpecCheckError, usageError } from "../errors.js";
import { renderJson } from "../report/json.js";
import { renderMarkdown } from "../report/markdown.js";
import { renderSarif } from "../report/sarif.js";
import { RULES } from "../rules/rules.js";
import { TOOL_VERSION } from "../version.js";
/** Text printed by `spec-check --help`. */
export const HELP = `Spec Check ${TOOL_VERSION} — is each requirement clear and verifiable enough to build from?

Usage:
  spec-check analyze [paths...] [options]  Report findings (exit 0 unless a fatal error occurs)
  spec-check check   [paths...] [options]  Report, then apply the policy (exit 4 on policy failure)
  spec-check rules                         List the rules
  spec-check schema                        Print the JSON Schema of the report
  spec-check --help | --version

Paths are Markdown files or directories. Without paths, \`include\` globs from the config are used
(default: specs/*/spec.md, the GitHub Spec Kit layout).

Options:
  --format <fmt>           markdown (default), json or sarif
  --output <file>          Write the report to a file instead of stdout
  --config <file>          JSON config/policy (default: .spec-check.json in --cwd, if present)
  --cwd <dir>              Working directory; report paths are relative to it (default: current directory)
  --no-excerpts            Do not quote spec lines in the report
  --no-branding            Omit the footer link in Markdown output
  --on-error <fail|pass>   Internal/input errors: fail (default; exit 1/3) or pass (warn, exit 0).
                           Usage errors always exit 2; policy failures always exit 4
  --quiet                  No progress messages on stderr
  -h, --help               Show this help
  -v, --version            Show the version

Default policy: \`check\` fails only on verified high-severity findings (unresolved clarifications, template
placeholders, duplicate IDs). Hypotheses never block unless the config opts in.
Exit codes: 0 ok · 1 internal error · 2 usage/config error · 3 input error · 4 policy failure (check)
Privacy: offline; no network access, no telemetry, nothing executed, no model used.
`;
/** Writes a report file atomically (temp file + rename); the parent directory must exist. */
function writeOutput(path, content) {
    if (existsSync(path) && statSync(path).isDirectory())
        throw usageError(`--output points to a directory: ${path}`);
    if (!existsSync(dirname(path)))
        throw usageError(`Output directory does not exist: ${dirname(path)}`);
    const temp = join(dirname(path), `.spec-check-${process.pid}-${Date.now()}.tmp`);
    writeFileSync(temp, content, { mode: 0o644 });
    renameSync(temp, path);
}
/** Returns the bundled report JSON Schema (works from both src/ and dist/). */
export function readSchema() {
    return readFileSync(new URL("../../schema/spec-check-report.schema.json", import.meta.url), "utf8");
}
/** Rule catalog as a plain-text table. */
function rulesText() {
    const rows = Object.values(RULES).map((r) => `${r.id.padEnd(26)} ${r.category.padEnd(14)} ${r.status.padEnd(21)} ${r.severity.padEnd(7)} ${r.title}`);
    return `${"rule".padEnd(26)} ${"category".padEnd(14)} ${"status".padEnd(21)} ${"severity".padEnd(7)} title\n${rows.join("\n")}\n`;
}
/** Set by --on-error pass: internal/input errors become warnings with exit 0 (fail-open). */
let failOpen = false;
/** Parses arguments and runs one command. Throws SpecCheckError for expected failures. */
async function main(argv, io) {
    const { values, positionals } = (() => {
        try {
            return parseArgs({
                args: argv,
                allowPositionals: true,
                strict: true,
                options: {
                    format: { type: "string" },
                    output: { type: "string" },
                    config: { type: "string" },
                    cwd: { type: "string" },
                    "no-excerpts": { type: "boolean" },
                    "no-branding": { type: "boolean" },
                    "on-error": { type: "string" },
                    offline: { type: "boolean" },
                    quiet: { type: "boolean" },
                    help: { type: "boolean", short: "h" },
                    version: { type: "boolean", short: "v" },
                },
            });
        }
        catch (error) {
            throw usageError(error.message, "Run `spec-check --help` for usage.");
        }
    })();
    if (values.help) {
        io.stdout(HELP);
        return ExitCode.Ok;
    }
    if (values.version) {
        io.stdout(`${TOOL_VERSION}\n`);
        return ExitCode.Ok;
    }
    const [command, ...paths] = positionals;
    if (command === undefined) {
        io.stderr(HELP);
        return ExitCode.Usage;
    }
    if (command === "schema" || command === "rules") {
        if (paths.length > 0)
            throw usageError(`Unexpected argument: ${paths[0]}`);
        io.stdout(command === "schema" ? readSchema() : rulesText());
        return ExitCode.Ok;
    }
    if (command !== "analyze" && command !== "check") {
        throw usageError(`Unknown command: ${command}`, "Commands: analyze, check, rules, schema.");
    }
    const onError = values["on-error"] ?? "fail";
    if (onError !== "fail" && onError !== "pass")
        throw usageError(`--on-error must be "fail" or "pass"`);
    failOpen = onError === "pass";
    const format = values.format ?? "markdown";
    if (format !== "markdown" && format !== "json" && format !== "sarif")
        throw usageError(`--format must be "markdown", "json" or "sarif"`);
    const cwd = values.cwd ? resolve(io.cwd, values.cwd) : io.cwd;
    if (!existsSync(cwd) || !statSync(cwd).isDirectory())
        throw usageError(`--cwd is not a directory: ${values.cwd ?? cwd}`);
    let config = DEFAULT_CONFIG;
    let configSource = "defaults";
    if (values.config !== undefined) {
        configSource = "--config";
        config = loadConfigFile(isAbsolute(values.config) ? values.config : resolve(io.cwd, values.config));
    }
    else if (existsSync(join(cwd, ".spec-check.json"))) {
        configSource = ".spec-check.json";
        config = loadConfigFile(join(cwd, ".spec-check.json"));
    }
    const report = analyze({
        cwd,
        paths,
        config,
        configSource,
        policy: command === "check",
        excerpts: config.excerpts && !values["no-excerpts"],
        ...(io.now ? { now: io.now } : {}),
    });
    const rendered = format === "json"
        ? renderJson(report)
        : format === "sarif"
            ? renderSarif(report)
            : renderMarkdown(report, { branding: !values["no-branding"] });
    if (values.output !== undefined)
        writeOutput(isAbsolute(values.output) ? values.output : resolve(io.cwd, values.output), rendered);
    else
        io.stdout(rendered);
    if (!values.quiet) {
        const s = report.summary;
        io.stderr(`spec-check: ${s.files} file(s), ${s.requirements} requirement(s), ${s.findings} finding(s)` +
            (report.policy.evaluated ? `, policy ${report.policy.result}` : "") +
            "\n");
    }
    return report.policy.result === "fail" ? ExitCode.Policy : ExitCode.Ok;
}
/** Runs the CLI and returns the process exit code. Never throws. */
export async function run(argv, io) {
    failOpen = false;
    try {
        return await main(argv, io);
    }
    catch (error) {
        if (error instanceof SpecCheckError) {
            io.stderr(`spec-check: error: ${error.message}\n`);
            if (error.hint)
                io.stderr(`spec-check: hint: ${error.hint}\n`);
            if (failOpen && error.exitCode === ExitCode.Input) {
                io.stderr("spec-check: warning: --on-error pass: continuing with exit 0\n");
                return ExitCode.Ok;
            }
            return error.exitCode;
        }
        io.stderr(`spec-check: internal error: ${error?.message ?? String(error)}\n`);
        if (failOpen) {
            io.stderr("spec-check: warning: --on-error pass: continuing with exit 0\n");
            return ExitCode.Ok;
        }
        return ExitCode.Internal;
    }
}
