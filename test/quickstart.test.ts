/**
 * README quickstart with the built CLI as a separate process: the demo must reproduce the committed sample
 * reports byte-for-byte (apart from normalized run metadata). Skipped when dist/ has not been built.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .mjs helper without type declarations
import { normalizeJson } from "../scripts/generate-demo-output.mjs";
import { tempSpecs } from "./helpers.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const bin = join(root, "dist/cli/main.js");
const sample = (name: string): string => readFileSync(join(root, "examples/demo/output", name), "utf8");

describe.runIf(existsSync(bin))("README quickstart with the built CLI", () => {
  it("reproduces the committed demo reports and exits 4 on the demo's policy failure", () => {
    const demo = tempSpecs({});
    cpSync(join(root, "examples/demo/specs"), join(demo, "specs"), { recursive: true });
    const env = { PATH: process.env["PATH"] ?? "" };
    const md = spawnSync(process.execPath, [bin, "check"], { cwd: demo, encoding: "utf8", env });
    expect(md.status).toBe(4);
    expect(md.stdout).toBe(sample("spec-check-report.md"));
    expect(md.stderr).toContain("policy fail");
    const json = spawnSync(process.execPath, [bin, "check", "--quiet", "--format", "json"], {
      cwd: demo,
      encoding: "utf8",
      env,
    });
    expect((normalizeJson as (t: string) => string)(json.stdout)).toBe(sample("spec-check-report.json"));
    const sarif = spawnSync(process.execPath, [bin, "check", "--quiet", "--format", "sarif"], {
      cwd: demo,
      encoding: "utf8",
      env,
    });
    expect(sarif.stdout).toBe(sample("spec-check-report.sarif"));
    const help = spawnSync(process.execPath, [bin, "--help"], { encoding: "utf8", env });
    expect(help.status).toBe(0);
  });
});
