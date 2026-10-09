# Spec Check — behavior specification (alpha 0.1)

Status: written **before** implementation (spec-first, addendum invariant 1). Acceptance tests in
`test/acceptance/` encode section 7 and were committed failing before the analyzers existed.

## 1. Problem and user

A developer, tech lead, architect or PM is about to hand a specification to a person or an AI coding agent. Spec
Check answers one question: **is each requirement in this spec clear and verifiable enough to build from, and
where exactly is it not?**

It is deterministic, offline and read-only. It never executes anything, never calls a model and never sends data
anywhere.

## 2. Relationship to existing tools (differentiation audit, `progress/UPSTREAM_RESEARCH.md`)

| Tool | What it already does | What Spec Check does instead |
|---|---|---|
| GitHub Spec Kit 1.1.2 | Templates; `/speckit.analyze`, `clarify`, `checklist` are AI prompts | Deterministic checks of the spec text Spec Kit produces. Never replaces Spec Kit. |
| DocGuard (MIT) | Mandatory sections, ID formats, requirement↔test traceability, phantom tasks | **Not re-implemented.** Spec Check does not check section structure or test traceability. |
| spec-gates (MIT) | Executes `accept` shell blocks | **Never executes** anything. |

Spec Check's niche: **per-requirement verifiability** with evidence, a tri-state status and a portable
requirements inventory.

## 3. Inputs

- Markdown files (`.md`, `.markdown`). Spec Kit `spec.md` files get Spec Kit-aware parsing (user stories,
  acceptance scenarios, `FR-###`/`SC-###` items, template placeholders). Any other Markdown is parsed generically.
- Positional paths (files or directories). Without paths: `include` globs from config, else `specs/*/spec.md`
  (Spec Kit layout). Directories are walked for Markdown files, skipping `node_modules/` and `.git/`.
- Optional `.spec-check.json` (data only; unknown keys rejected; no user regular expressions).
- Optional per-file front matter (`---` block, flat `key: value` lines): `owner`, `spec_check_disable`.

**Parsing model (line-based, documented limits):** front matter; ATX headings; list items with continuation lines;
fenced code blocks (skipped, except ` ```gherkin ` / ` ```feature `, which are parsed as scenarios); HTML comments
(skipped, except suppression directives); inline code spans (ignored by heuristic rules). Setext headings,
tables and nested HTML are treated as plain text (limitation `markdown-subset`).

## 4. Requirements inventory

Every detected item becomes an inventory entry (`requirements[]`), whether or not it has findings:

| Kind | Detected from |
|---|---|
| `functional` | list item / line starting with an ID whose prefix maps to functional (default `FR`, `REQ`) |
| `non_functional` | prefix `NFR` |
| `success_criterion` | prefix `SC`, `AC` |
| `functional` (no ID) | in generic Markdown: a list item under a heading containing "requirement" that uses MUST/SHALL/SHOULD |

ID pattern: `<PREFIX>-<1–5 digits>`, optionally in `**bold**`, followed by `:`. Prefixes are letters only
(config `id_prefixes`). Each entry lists `references` (IDs it mentions), `has_measure` and its `finding_ids`.
Scenarios (Given/When/Then lines and Gherkin scenarios) and Spec Kit user stories are counted per file.

## 5. Rules

`status`: `verified_static_fact` = decided by a parser/structural fact; `hypothesis` = lexical judgement a human must
confirm; `unknown` = cannot decide. No numeric score. Severity and confidence are categorical.

| rule_id | category | status | severity | fires when |
|---|---|---|---|---|
| `needs-clarification` | clarity | verified_static_fact | high | `[NEEDS CLARIFICATION…]` marker in non-code text |
| `template-placeholder` | clarity | verified_static_fact | high | a Spec Kit 1.1.2 template placeholder is still present (exact list in `src/rules/lexicon.ts`) |
| `template-placeholder` | clarity | hypothesis | medium | a bracketed phrase looks like a placeholder (`[some words]`, not a link, checkbox, footnote or reference) |
| `open-marker` | clarity | verified_static_fact | medium | `TBD`, `TODO`, `FIXME`, `XXX` or `???` in requirement, criterion or scenario text |
| `vague-term` | clarity | hypothesis | low | a requirement or scenario uses a term from the vague lexicon and contains no number (criteria are covered by the next rule) |
| `unmeasurable-criterion` | verifiability | hypothesis | medium | a success criterion with no quantity, threshold or universal quantifier |
| `scenario-incomplete` | verifiability | verified_static_fact | medium | a Given/When/Then line or Gherkin scenario lacks Given, When or Then, or has them out of order |
| `story-without-scenarios` | verifiability | verified_static_fact | medium | a Spec Kit user story has no acceptance scenario |
| `missing-edge-cases` | coverage | hypothesis | medium | a file with requirements has no non-placeholder edge case and no negative wording |
| `missing-non-functional` | coverage | hypothesis | info | a file with requirements mentions no non-functional quality |
| `duplicate-id` | integrity | verified_static_fact | high | the same ID is defined twice across the input set |
| `dangling-reference` | integrity | verified_static_fact | medium | an ID is referenced but defined in no input file |
| `missing-owner` | ownership | verified_static_fact | low | only with `require_owner: true`: no `owner` front matter and no `**Owner**:` line |

"Number": a digit, a number word or a percentage (IDs such as `FR-001` are ignored). "Measure" (criteria only): a
number or a universal quantifier (`all`, `every`, `each`, `none`, `no`, `never`, `always`, `only`). Lexicons are
English-only (limitation `english-lexicon`).

Each finding has: `id` (`<rule>:<sha256-8>` of path, rule and normalized item text, stable across unrelated edits),
`rule_id`, `category`, `severity`, `status`, `confidence`, `is_heuristic` (`status !== verified_static_fact`),
`summary`, `explanation`, `recommended_human_action`, `evidence[]` (`path`, `line_start`, `line_end`, `detail`,
`excerpt`) and `requirement_ids[]`.

**Excerpts** are at most 160 characters of the offending line, secret-redacted, and omitted with `--no-excerpts`.
Unlike Impact Check (which never emits source), quoting the spec line is the point of a spec linter; the redactor
and escaping still apply.

## 6. Outputs, commands and exit codes

```
spec-check analyze [paths...]  report only; exit 0 unless a fatal error occurs
spec-check check   [paths...]  report + policy; exit 4 on policy failure
spec-check rules               print the rule catalog
spec-check schema              print the JSON Schema
Options: --format markdown|json|sarif  --output <file>  --config <file>  --cwd <dir>
         --no-excerpts  --no-branding  --on-error fail|pass  --quiet  -h/--help  -v/--version
```

- JSON (`schema/spec-check-report.schema.json`, `schema_version` "1.0"), Markdown, SARIF 2.1.0.
- Exit codes: 0 ok · 1 internal error · 2 usage/config error · 3 input error (no spec found, unreadable path) ·
  4 policy failure (`check` only).
- **Default policy** (human authority, invariant 6): `check` fails only on `verified_static_fact` findings of severity
  `high` (unresolved clarifications, template placeholders, duplicate IDs). Hypotheses never block unless the
  config opts in (`fail_on.statuses`). `analyze` never fails on findings.
- `--on-error pass` turns internal/input errors into a warning and exit 0 (fail-open). Usage errors and policy
  failures are never masked.

Determinism: paths are relative to `--cwd` with `/` separators; findings sorted by path, line, rule, id; only
`run_metadata.generated_at` and `duration_ms` vary between runs.

## 7. Acceptance scenarios (verification-first)

| # | Fixture | Expected |
|---|---|---|
| S1 | complete Spec Kit spec | 0 findings; policy pass; inventory lists every FR/SC with `has_measure` |
| S2 | untouched template-like spec | `template-placeholder` verified/high; `check` exits 4 |
| S3 | `[NEEDS CLARIFICATION]` in FR-006 | `needs-clarification` verified/high with `requirement_ids: ["FR-006"]` |
| S4 | "respond quickly" vs "respond quickly (p95 under 300 ms)" | finding for the first only (negative control) |
| S5 | SC without quantity vs SC with "90%" | `unmeasurable-criterion` for the first only |
| S6 | Given…Then (no When); story with no scenarios; Gherkin fence missing Then | `scenario-incomplete` ×2, `story-without-scenarios` ×1 |
| S7 | FR-002 defined twice; reference to FR-009 (undefined); reference to SC-001 defined in another file | `duplicate-id`, `dangling-reference` (FR-009 only) |
| S8 | generic Markdown with MUST bullets, no edge cases, no NFR | inventory without IDs; `missing-edge-cases`, `missing-non-functional` |
| S9 | adversarial: prompt-injection text, HTML/script, backticks, @mentions, secret, bidi; markers inside code fences and HTML comments; symlink; binary file | injection text has no effect; Markdown escaped; secret redacted; fenced/commented markers ignored; symlink and binary skipped with limitations |
| S10 | suppression comment + front matter | findings suppressed and listed in `suppressions[]` with the line of the directive or front-matter key |
| S11 | any | JSON validates against the schema; two runs identical after removing timing fields; SARIF structurally valid |
| S12 | no input / bad config / bad flag | exit 3 / 2 / 2 with a hint |

## 8. Non-goals

Proving a spec is complete or correct; generating specs or code; checking section structure or test traceability
(DocGuard); executing acceptance criteria (spec-gates); LLM review (a later, opt-in BYOK extension, labelled
hypothesis, off by default); non-English lexicons; a 0–100 quality score; cloud storage; telemetry.

## 9. Misuse cases and threat model (summary; detail in `docs/THREAT_MODEL.md`)

- **Spec text as instructions:** specs are untrusted data. Nothing in a spec changes Spec Check's behavior except the
  documented front-matter keys and suppression comments, both of which are reported in output.
- **Gaming via suppression:** every suppression is listed in the report with its location.
- **Markdown/HTML injection into PR comments or job summaries:** all spec-derived text is escaped (code spans for
  excerpts); `@mentions` are neutralized; control/bidi characters are made visible.
- **Secret leakage via excerpts:** redaction of token-like strings; `--no-excerpts`.
- **Resource exhaustion:** caps of 1,000 files, 2 MiB per file and 5,000 findings, each reported as a limitation.
- **Path tricks:** symlinks are never followed; non-UTF-8/binary files are skipped; only Markdown extensions are read.
- **Over-trust:** hypotheses are labelled; the report states that passing Spec Check does not mean a spec is complete.
