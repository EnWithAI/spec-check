// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * GitHub Action runner: report files, job summary and outputs; report-only vs blocking policy; explicit
 * fail-open/fail-closed error handling; input validation (relative paths only, strict booleans).
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAction } from "../src/action/run.js";
import { copyFixture, tempSpecs } from "./helpers.js";

function actionEnv(workspace: string, inputs: Record<string, string> = {}): Record<string, string> {
  const outputs = join(tempSpecs({}), "outputs");
  const summary = join(tempSpecs({}), "summary.md");
  writeFileSync(outputs, "");
  writeFileSync(summary, "");
  return {
    GITHUB_WORKSPACE: workspace,
    GITHUB_OUTPUT: outputs,
    GITHUB_STEP_SUMMARY: summary,
    ...Object.fromEntries(
      Object.entries(inputs).map(([k, v]) => [`INPUT_${k.toUpperCase().replace(/-/g, "_")}`, v])
    ),
  };
}

const outputs = (env: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    readFileSync(env["GITHUB_OUTPUT"]!, "utf8")
      .trim()
      .split("\n")
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
  );

describe("GitHub Action", () => {
  it("report-only by default: writes reports, summary and outputs, exits 0 on policy failure", () => {
    const ws = copyFixture("s3-clarification");
    const env = actionEnv(ws);
    const logs: string[] = [];
    expect(runAction({ env, log: (t) => logs.push(t) })).toBe(0);
    for (const ext of ["json", "md", "sarif"])
      expect(existsSync(join(ws, `spec-check-report/spec-check-report.${ext}`))).toBe(true);
    expect(readFileSync(env["GITHUB_STEP_SUMMARY"]!, "utf8")).toContain("# Spec Check report");
    expect(outputs(env)).toMatchObject({
      policy: "failed",
      findings: "1",
      "high-findings": "1",
      status: "ok",
    });
    expect(logs.join("\n")).toContain("::warning::Spec Check policy failed");
  });

  it("fail-on-policy=true exits 4; passing specs exit 0", () => {
    const failing = actionEnv(copyFixture("s3-clarification"), { "fail-on-policy": "true" });
    expect(runAction({ env: failing, log: () => undefined })).toBe(4);
    const passing = actionEnv(copyFixture("s1-clean"), { "fail-on-policy": "true" });
    expect(runAction({ env: passing, log: () => undefined })).toBe(0);
    expect(outputs(passing).policy).toBe("passed");
  });

  it("paths input (newline-separated), working directory and config path", () => {
    const ws = tempSpecs({});
    const project = copyFixture("s7-integrity");
    cpSync(project, join(ws, "proj"), { recursive: true });
    writeFileSync(join(ws, "proj/policy.json"), JSON.stringify({ fail_on: { severity: "never" } }));
    const env = actionEnv(ws, {
      "working-directory": "proj",
      paths: "specs/001-a\nspecs/002-b\n",
      "config-path": "policy.json",
      "fail-on-policy": "true",
    });
    expect(runAction({ env, log: () => undefined })).toBe(0);
    const report = JSON.parse(readFileSync(join(ws, "spec-check-report/spec-check-report.json"), "utf8"));
    expect(report.inputs).toHaveLength(2);
    expect(report.run_metadata.config_source).toBe("policy.json");
  });

  it("tool errors: warn (fail-open) by default when report-only, fail-closed when blocking; usage errors always fail", () => {
    const empty = tempSpecs({ "README.md": "# x\n" });
    const open = actionEnv(empty);
    expect(runAction({ env: open, log: () => undefined })).toBe(0);
    expect(outputs(open).status).toBe("error");
    expect(runAction({ env: actionEnv(empty, { "fail-on-policy": "true" }), log: () => undefined })).toBe(3);
    expect(runAction({ env: actionEnv(empty, { "on-error": "fail" }), log: () => undefined })).toBe(3);
    expect(
      runAction({
        env: actionEnv(empty, { "fail-on-policy": "true", "on-error": "warn" }),
        log: () => undefined,
      })
    ).toBe(0);
    const ws = copyFixture("s1-clean");
    for (const bad of [
      { paths: "../outside" },
      { paths: "/etc" },
      { "output-dir": "../x" },
      { "fail-on-policy": "yes" },
      { excerpts: "no" },
      { "on-error": "maybe" },
    ]) {
      expect(runAction({ env: actionEnv(ws, bad), log: () => undefined }), JSON.stringify(bad)).toBe(2);
    }
  });

  it("action.yml uses env for every input and no pull_request_target", () => {
    const yml = readFileSync(new URL("../action.yml", import.meta.url), "utf8");
    const run = yml.slice(yml.indexOf("run: |"));
    expect(run).not.toMatch(/\$\{\{\s*inputs\./);
    expect(yml).not.toMatch(/^\s*pull_request_target/m);
  });
});
