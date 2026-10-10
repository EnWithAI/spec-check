// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * GitHub Action runner (docs/ACTION.md). Reads inputs from INPUT_* environment variables (never from shell
 * interpolation), analyzes in-process, writes JSON/Markdown/SARIF files, the job summary and step outputs.
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { analyze } from "../analyze.js";
import { DEFAULT_CONFIG, loadConfigFile, type Config } from "../config.js";
import { ExitCode, SpecCheckError } from "../errors.js";
import { renderJson } from "../report/json.js";
import { renderMarkdown } from "../report/markdown.js";
import { renderSarif } from "../report/sarif.js";

/** Environment and output seams for tests. */
export interface ActionIO {
  env: Record<string, string | undefined>;
  log: (text: string) => void;
}

/** Rejects absolute paths and `..` segments in workspace-relative inputs. */
function relativeInput(value: string, name: string): string {
  const normalized = value.trim().replace(/\\/g, "/");
  if (normalized === "" || isAbsolute(normalized) || normalized.split("/").includes(".."))
    throw new SpecCheckError(`Input ${name} must be a relative path inside the workspace`, ExitCode.Usage);
  return normalized;
}

/** Appends `name=value` to the step outputs file when available. */
function setOutput(io: ActionIO, name: string, value: string): void {
  const file = io.env["GITHUB_OUTPUT"];
  if (file) appendFileSync(file, `${name}=${value.replace(/[\r\n]/g, " ")}\n`);
}

/** Runs the action; returns the process exit code. */
export function runAction(io: ActionIO): number {
  const input = (name: string, fallback: string): string => io.env[`INPUT_${name}`]?.trim() || fallback;
  const failOnPolicy = input("FAIL_ON_POLICY", "false") === "true";
  const onErrorInput = input("ON_ERROR", "auto");
  const failClosed = onErrorInput === "fail" || (onErrorInput === "auto" && failOnPolicy);
  try {
    if (!["auto", "fail", "warn"].includes(onErrorInput))
      throw new SpecCheckError("Input on-error must be auto, fail or warn", ExitCode.Usage);
    for (const name of ["FAIL_ON_POLICY", "EXCERPTS"])
      if (!["true", "false"].includes(input(name, name === "EXCERPTS" ? "true" : "false")))
        throw new SpecCheckError(
          `Input ${name.toLowerCase().replace(/_/g, "-")} must be true or false`,
          ExitCode.Usage
        );
    const workspace = io.env["GITHUB_WORKSPACE"] ?? process.cwd();
    const cwd = resolve(workspace, relativeInput(input("WORKING_DIRECTORY", "."), "working-directory"));
    const paths = input("PATHS", "")
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => relativeInput(p, "paths"));
    const configPath = relativeInput(input("CONFIG_PATH", ".spec-check.json"), "config-path");
    let config: Config = DEFAULT_CONFIG;
    let configSource = "defaults";
    if (existsSync(join(cwd, configPath))) {
      config = loadConfigFile(join(cwd, configPath));
      configSource = configPath;
    }
    const report = analyze({
      cwd,
      paths,
      config,
      configSource,
      policy: true,
      excerpts: config.excerpts && input("EXCERPTS", "true") !== "false",
    });
    const outDir = resolve(workspace, relativeInput(input("OUTPUT_DIR", "spec-check-report"), "output-dir"));
    mkdirSync(outDir, { recursive: true });
    const markdown = renderMarkdown(report, { branding: true });
    writeFileSync(join(outDir, "spec-check-report.json"), renderJson(report));
    writeFileSync(join(outDir, "spec-check-report.md"), markdown);
    writeFileSync(join(outDir, "spec-check-report.sarif"), renderSarif(report));
    if (io.env["GITHUB_STEP_SUMMARY"]) appendFileSync(io.env["GITHUB_STEP_SUMMARY"], markdown);
    const rel = input("OUTPUT_DIR", "spec-check-report");
    setOutput(io, "report-json", `${rel}/spec-check-report.json`);
    setOutput(io, "report-markdown", `${rel}/spec-check-report.md`);
    setOutput(io, "report-sarif", `${rel}/spec-check-report.sarif`);
    setOutput(io, "findings", String(report.summary.findings));
    setOutput(io, "high-findings", String(report.summary.by_severity.high));
    setOutput(io, "policy", report.policy.result === "fail" ? "failed" : "passed");
    setOutput(io, "status", "ok");
    io.log(`spec-check: ${report.summary.findings} finding(s), policy ${report.policy.result}`);
    if (report.policy.result === "fail") {
      io.log(
        `::${failOnPolicy ? "error" : "warning"}::Spec Check policy failed (${report.policy.violations.length} violation(s))`
      );
      return failOnPolicy ? ExitCode.Policy : ExitCode.Ok;
    }
    return ExitCode.Ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const usage = error instanceof SpecCheckError && error.exitCode === ExitCode.Usage;
    setOutput(io, "status", "error");
    if (usage || failClosed) {
      io.log(`::error::Spec Check failed: ${message.replace(/[\r\n]/g, " ")}`);
      return error instanceof SpecCheckError ? error.exitCode : ExitCode.Internal;
    }
    io.log(
      `::warning::Spec Check could not run (fail-open, on-error=${onErrorInput}): ${message.replace(/[\r\n]/g, " ")}`
    );
    return ExitCode.Ok;
  }
}
