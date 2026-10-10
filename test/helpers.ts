// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Test helpers: run the CLI in-process, copy fixtures into temporary directories and load reports.
 */
import { cpSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../src/cli/run.js";
import type { Report } from "../src/types.js";

/** Absolute path of a fixture directory. */
export const fixture = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** Result of an in-process CLI run. */
export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs the CLI in-process with a fixed clock. */
export async function cli(args: string[], cwd: string): Promise<CliResult> {
  let stdout = "";
  let stderr = "";
  const code = await run(args, {
    stdout: (t) => (stdout += t),
    stderr: (t) => (stderr += t),
    cwd,
    now: () => new Date("2026-10-09T00:00:00.000Z"),
  });
  return { code, stdout, stderr };
}

/**
 * A fake token in GitHub's format, assembled at run time so that no token-shaped string is committed (keeps secret
 * scanning and push protection quiet). Fixtures reference it as __FAKE_GITHUB_TOKEN__.
 */
export const FAKE_GITHUB_TOKEN = ["ghp", "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].join("_");

/** Replaces the fake-token placeholder in every file under a directory. */
function injectFakeToken(dir: string): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) injectFakeToken(path);
    else {
      const text = readFileSync(path, "utf8");
      if (text.includes("__FAKE_GITHUB_TOKEN__"))
        writeFileSync(path, text.replaceAll("__FAKE_GITHUB_TOKEN__", FAKE_GITHUB_TOKEN));
    }
  }
}

/** Copies a fixture into a fresh temporary directory and returns its path. */
export function copyFixture(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), "spec-check-"));
  cpSync(fixture(name), dir, { recursive: true, verbatimSymlinks: true });
  injectFakeToken(dir);
  return dir;
}

/** Creates a temporary directory containing the given files. */
export function tempSpecs(files: Record<string, string | Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), "spec-check-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

/** Runs `analyze --format json` and parses the report. */
export async function analyzeJson(cwd: string, args: string[] = []): Promise<Report> {
  const result = await cli(["analyze", "--format", "json", "--quiet", ...args], cwd);
  if (result.code !== 0) throw new Error(`analyze exited ${result.code}: ${result.stderr}`);
  return JSON.parse(result.stdout) as Report;
}
