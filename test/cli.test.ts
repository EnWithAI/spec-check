// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * CLI contract (S12): help/version, exit codes for usage, input and policy errors, config handling, output
 * files and fail-open behavior.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeJson, cli, copyFixture, tempSpecs } from "./helpers.js";

describe("CLI contract (S12)", () => {
  it("prints help and version with exit 0; no command prints help with exit 2", async () => {
    const dir = tempSpecs({});
    const help = await cli(["--help"], dir);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain("spec-check check");
    expect(help.stdout).toContain("Exit codes");
    expect((await cli(["--version"], dir)).stdout).toMatch(/^\d+\.\d+\.\d+/);
    const none = await cli([], dir);
    expect(none.code).toBe(2);
    expect(none.stderr).toContain("Usage");
  });

  it("usage errors exit 2 with a hint", async () => {
    const dir = copyFixture("s4-vague");
    for (const args of [
      ["frobnicate"],
      ["analyze", "--bogus"],
      ["analyze", "--format", "xml"],
      ["analyze", "--on-error", "maybe"],
      ["analyze", "--cwd", "does-not-exist"],
      ["rules", "extra"],
      ["analyze", "spec.md", "--output", "missing-dir/out.md"],
      ["analyze", "spec.md", "--output", "."],
    ]) {
      const result = await cli(args, dir);
      expect(result.code, args.join(" ")).toBe(2);
      expect(result.stderr).toContain("spec-check: error:");
    }
  });

  it("input errors exit 3 with a hint; --on-error pass turns them into exit 0", async () => {
    const empty = tempSpecs({ "README.md": "# hi\n" });
    const none = await cli(["check"], empty);
    expect(none.code).toBe(3);
    expect(none.stderr).toContain("hint:");
    expect((await cli(["check", "nope.md"], empty)).code).toBe(3);
    expect((await cli(["check", "--on-error", "pass"], empty)).code).toBe(0);
    const emptyDir = tempSpecs({ "docs/notes.txt": "x" });
    expect((await cli(["analyze", "docs"], emptyDir)).code).toBe(3);
  });

  it("--on-error pass never masks policy failures or usage errors", async () => {
    const dir = copyFixture("s3-clarification");
    expect((await cli(["check", "--quiet", "--on-error", "pass"], dir)).code).toBe(4);
    expect((await cli(["check", "--bad", "--on-error", "pass"], dir)).code).toBe(2);
  });

  it("analyze never fails on findings; check applies the default policy", async () => {
    const dir = copyFixture("s3-clarification");
    expect((await cli(["analyze", "--quiet"], dir)).code).toBe(0);
    const check = await cli(["check", "--format", "json"], dir);
    expect(check.code).toBe(4);
    const report = JSON.parse(check.stdout);
    expect(report.policy.result).toBe("fail");
    expect(report.policy.violations).toHaveLength(1);
    expect(check.stderr).toContain("policy fail");
  });

  it("config: hypotheses can be made blocking; rules can be turned off or re-ranked; fail_on never", async () => {
    const dir = copyFixture("s4-vague");
    writeFileSync(
      join(dir, "strict.json"),
      JSON.stringify({ fail_on: { severity: "low", statuses: ["hypothesis"] } })
    );
    expect((await cli(["check", "spec.md", "--quiet", "--config", "strict.json"], dir)).code).toBe(4);
    writeFileSync(join(dir, ".spec-check.json"), JSON.stringify({ rules: { "vague-term": "off" } }));
    const off = await analyzeJson(dir, ["spec.md"]);
    expect(off.findings).toHaveLength(0);
    expect(off.run_metadata.disabled_rules).toEqual(["vague-term"]);
    expect(off.run_metadata.config_source).toBe(".spec-check.json");
    writeFileSync(
      join(dir, ".spec-check.json"),
      JSON.stringify({ rules: { "vague-term": { severity: "high" } } })
    );
    const ranked = await analyzeJson(dir, ["spec.md"]);
    expect(ranked.findings.every((f) => f.severity === "high")).toBe(true);
    expect((await cli(["check", "spec.md", "--quiet"], dir)).code).toBe(0); // high but hypothesis → not blocking
    const s3 = copyFixture("s3-clarification");
    writeFileSync(join(s3, ".spec-check.json"), JSON.stringify({ fail_on: { severity: "never" } }));
    expect((await cli(["check", "--quiet"], s3)).code).toBe(0);
  });

  it("invalid config exits 2", async () => {
    const dir = copyFixture("s4-vague");
    for (const bad of [
      "{",
      "[]",
      '{"unknown":1}',
      '{"rules":{"nope":"off"}}',
      '{"fail_on":{"severity":"bad"}}',
    ]) {
      writeFileSync(join(dir, ".spec-check.json"), bad);
      expect((await cli(["analyze", "spec.md"], dir)).code, bad).toBe(2);
    }
    expect((await cli(["analyze", "spec.md", "--config", "missing.json"], dir)).code).toBe(2);
  });

  it("--output writes the report atomically and nothing else is written", async () => {
    const dir = copyFixture("s1-clean");
    const result = await cli(["check", "--format", "sarif", "--output", "out.sarif"], dir);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    expect(JSON.parse(readFileSync(join(dir, "out.sarif"), "utf8")).version).toBe("2.1.0");
    expect(existsSync(join(dir, "spec-check-report.md"))).toBe(false);
  });

  it("--cwd makes report paths relative to that directory", async () => {
    const dir = copyFixture("s7-integrity");
    const report = await analyzeJson(join(dir, ".."), ["--cwd", dir, "specs"]);
    expect(report.inputs.map((i) => i.path)).toEqual(["specs/001-a/spec.md", "specs/002-b/spec.md"]);
  });
});
