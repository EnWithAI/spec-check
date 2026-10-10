// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Report contract: JSON Schema validation for every acceptance fixture, determinism across runs and locations,
 * SARIF structure, and the schema/rules commands.
 */
import { readdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";
import { analyzeJson, cli, copyFixture } from "./helpers.js";
import type { Report } from "../src/types.js";

const schema = JSON.parse(
  readFileSync(new URL("../schema/spec-check-report.schema.json", import.meta.url), "utf8")
);
const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => void;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const fixtures = readdirSync(new URL("./fixtures/", import.meta.url)).sort();
const argsFor = (name: string): string[] =>
  (
    JSON.parse(readFileSync(new URL(`./acceptance/expected/${name}.json`, import.meta.url), "utf8")) as {
      args: string[];
    }
  ).args;

/** Removes the fields documented as run-specific. */
function normalize(report: Report): Report {
  return { ...report, run_metadata: { ...report.run_metadata, generated_at: "x", duration_ms: 0 } };
}

describe("JSON schema and determinism (S11)", () => {
  for (const name of fixtures) {
    it(`${name}: analyze and check reports validate against the schema`, async () => {
      const dir = copyFixture(name);
      if (name === "s9-adversarial") symlinkSync("../../../x.md", join(dir, "specs/009-evil/linked.md"));
      for (const command of ["analyze", "check"]) {
        const result = await cli([command, "--format", "json", "--quiet", ...argsFor(name)], dir);
        const report = JSON.parse(result.stdout) as unknown;
        if (!validate(report)) throw new Error(JSON.stringify(validate.errors, null, 2));
      }
    });
  }

  it("is deterministic across runs and directories (only generated_at and duration_ms vary)", async () => {
    for (const name of fixtures) {
      const a = normalize(await analyzeJson(copyFixture(name), argsFor(name)));
      const b = normalize(await analyzeJson(copyFixture(name), argsFor(name)));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it("schema command prints the bundled schema; rules lists every rule", async () => {
    const dir = copyFixture("s1-clean");
    expect(JSON.parse((await cli(["schema"], dir)).stdout)).toEqual(schema);
    const rules = (await cli(["rules"], dir)).stdout;
    for (const id of schema.$defs.finding.properties.rule_id.enum as string[]) expect(rules).toContain(id);
  });
});

describe("SARIF 2.1.0", () => {
  it("emits one result per finding with locations, levels and hypothesis labels", async () => {
    const dir = copyFixture("s7-integrity");
    const json = await analyzeJson(dir, ["specs"]);
    const sarif = JSON.parse((await cli(["analyze", "--format", "sarif", "--quiet", "specs"], dir)).stdout);
    expect(sarif.version).toBe("2.1.0");
    const run = sarif.runs[0];
    expect(run.tool.driver.name).toBe("spec-check");
    expect(run.results).toHaveLength(json.findings.length);
    const dup = run.results.find((r: { ruleId: string }) => r.ruleId === "duplicate-id");
    expect(dup.level).toBe("error");
    expect(dup.locations).toHaveLength(2);
    expect(dup.locations[0].physicalLocation.region.startLine).toBe(6);
    expect(dup.locations[0].physicalLocation.artifactLocation.uri).toBe("specs/001-a/spec.md");
    for (const r of run.results) {
      expect(run.tool.driver.rules[r.ruleIndex].id).toBe(r.ruleId);
      expect(r.properties.status).toMatch(/verified_static_fact|hypothesis|unknown/);
    }
    const vague = JSON.parse(
      (await cli(["analyze", "--format", "sarif", "--quiet", "spec.md"], copyFixture("s4-vague"))).stdout
    );
    expect(vague.runs[0].results[0].properties.is_heuristic).toBe(true);
    expect(vague.runs[0].results[0].level).toBe("note");
  });
});
