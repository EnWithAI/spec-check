# Spec Check — behavior specification (0.1, design-package profile 0.2)

Status: written **before** implementation (spec-first, addendum invariant 1). Acceptance tests in
`test/acceptance/` encode section 7 and were committed failing before the analyzers existed.

## 1. Problem and user

A developer, tech lead, architect or PM is about to hand a specification to a person or an AI coding agent. Spec
Check answers one question: **is each requirement in this spec clear and verifiable enough to build from, and
where exactly is it not?**

It is deterministic, offline and read-only. It never executes anything, never calls a model and never sends data
anywhere.

## 2. Relationship to existing tools (differentiation audit, `progress/UPSTREAM_RESEARCH.md`)

| Tool                  | What it already does                                                         | What Spec Check does instead                                                              |
| --------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GitHub Spec Kit 1.1.2 | Templates; `/speckit.analyze`, `clarify`, `checklist` are AI prompts         | Deterministic checks of the spec text Spec Kit produces. Never replaces Spec Kit.         |
| DocGuard (MIT)        | Mandatory sections, ID formats, requirement↔test traceability, phantom tasks | **Not re-implemented.** Spec Check does not check section structure or test traceability. |
| spec-gates (MIT)      | Executes `accept` shell blocks                                               | **Never executes** anything.                                                              |

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

| Kind                 | Detected from                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `functional`         | list item / line starting with an ID whose prefix maps to functional (default `FR`, `REQ`)            |
| `non_functional`     | prefix `NFR`                                                                                          |
| `success_criterion`  | prefix `SC`, `AC`                                                                                     |
| `functional` (no ID) | in generic Markdown: a list item under a heading containing "requirement" that uses MUST/SHALL/SHOULD |

ID pattern: `<PREFIX>-<1–5 digits>`, optionally in `**bold**`, followed by `:`. Prefixes are letters only
(config `id_prefixes`). Each entry lists `references` (IDs it mentions), `has_measure` and its `finding_ids`.
Scenarios (Given/When/Then lines and Gherkin scenarios) and Spec Kit user stories are counted per file.

## 5. Rules

`status`: `verified_static_fact` = decided by a parser/structural fact; `hypothesis` = lexical judgement a human must
confirm; `unknown` = cannot decide. No numeric score. Severity and confidence are categorical.

| rule_id                   | category      | status               | severity | fires when                                                                                                                  |
| ------------------------- | ------------- | -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `needs-clarification`     | clarity       | verified_static_fact | high     | `[NEEDS CLARIFICATION…]` marker in non-code text                                                                            |
| `template-placeholder`    | clarity       | verified_static_fact | high     | a Spec Kit 1.1.2 template placeholder is still present (exact list in `src/rules/lexicon.ts`)                               |
| `template-placeholder`    | clarity       | hypothesis           | medium   | a bracketed phrase looks like a placeholder (`[some words]`, not a link, checkbox, footnote or reference)                   |
| `open-marker`             | clarity       | verified_static_fact | medium   | `TBD`, `TODO`, `FIXME`, `XXX` or `???` in requirement, criterion or scenario text                                           |
| `vague-term`              | clarity       | hypothesis           | low      | a requirement or scenario uses a term from the vague lexicon and contains no number (criteria are covered by the next rule) |
| `unmeasurable-criterion`  | verifiability | hypothesis           | medium   | a success criterion with no quantity, threshold or universal quantifier                                                     |
| `scenario-incomplete`     | verifiability | verified_static_fact | medium   | a Given/When/Then line or Gherkin scenario lacks Given, When or Then, or has them out of order                              |
| `story-without-scenarios` | verifiability | verified_static_fact | medium   | a Spec Kit user story has no acceptance scenario                                                                            |
| `missing-edge-cases`      | coverage      | hypothesis           | medium   | a file with requirements has no non-placeholder edge case and no negative wording                                           |
| `missing-non-functional`  | coverage      | hypothesis           | info     | a file with requirements mentions no non-functional quality                                                                 |
| `duplicate-id`            | integrity     | verified_static_fact | high     | the same ID is defined twice across the input set                                                                           |
| `dangling-reference`      | integrity     | verified_static_fact | medium   | an ID is referenced but defined in no input file                                                                            |
| `missing-owner`           | ownership     | verified_static_fact | low      | only with `require_owner: true`: no `owner` front matter and no `**Owner**:` line                                           |

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

## 5a. Design-package profile (0.2, opt-in)

Added after 0.1 (Engineering Commons decisions D-079 to D-089). Enabled only by `"profile": "design-package"` in the
config; without it, reports are byte-identical to 0.1. The profile checks the documents that make up a design package:
decision records (ADRs), service-level targets, and whether security and AI governance are addressed at all. It checks
that the sections exist, never whether their content is adequate (limitation `design-package-content`).

**ADR files.** An analyzed file is an ADR when its path matches `design_package.adr_paths` (default
`doc/adr/*.md`, `docs/adr/*.md`, `docs/decisions/*.md`) and its file name starts with a number (`0001-…`, the
adr-tools and MADR convention). Index or template files in those folders (`README.md`, `adr-template.md`) are not
ADRs. Without positional paths, `adr_paths` are added to `include`. An ADR's number is the integer value of that
leading number.

**ADR status** is read from, in order: front matter `status:` (MADR 3+); a `Status:` line or list item
(`* Status: accepted`, MADR 2); the first block under a heading starting with "Status" (Nygard, adr-tools). The value
is its first word, lower-cased, without punctuation or emphasis ("Superseded by …" → `superseded`).

**Design package (unit for the coverage rules).** The non-ADR inputs that share a directory, for example one Spec Kit
feature folder (`spec.md`, `plan.md`, …). Run with `include` covering every document of the package.

| rule_id                           | category      | status               | severity | fires when                                                                                                                                                                                                                          |
| --------------------------------- | ------------- | -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adr-section-missing`             | integrity     | verified_static_fact | medium   | an ADR has no status (any of the three forms) or no heading starting with one of `design_package.adr_sections` (default `context`, `decision`, `consequences`). One finding per ADR listing every missing section                  |
| `adr-status-invalid`              | integrity     | verified_static_fact | medium   | the ADR status is not in `design_package.adr_statuses` (default `proposed`, `accepted`, `rejected`, `deprecated`, `superseded`)                                                                                                      |
| `adr-supersede-dangling`          | integrity     | verified_static_fact | medium   | a "superseded by" line in an ADR links to a file that is not an analyzed ADR, or names `ADR-N` / `ADR N` where no analyzed ADR has number N. Other wording is not interpreted                                                   |
| `nfr-without-slo`                 | verifiability | hypothesis           | low      | a `non_functional` item mentions a service-level quality (latency, response time, availability, uptime, error rate, throughput, durability, freshness, success rate, a percentile such as `p95`) but has no number, or has a number with neither a percentile/percentage nor a time window |
| `slo-without-sli`                 | verifiability | hypothesis           | low      | a block (not a heading) that mentions "SLO" and contains a number names no indicator (an "SLI" or one of the service-level qualities above, or "success rate", "requests")                                                       |
| `security-considerations-missing` | coverage      | verified_static_fact | medium   | a design package has no heading containing one of `design_package.security_headings` (default `security`, `threat`)                                                                                                             |
| `ai-governance-missing`           | coverage      | hypothesis           | medium   | a design package uses AI vocabulary (LLM, large language model, generative AI, machine learning, AI model, AI agent, model inference, embeddings, RAG, fine-tuning, foundation model, chatbot, system prompt, prompt injection) but has no heading containing one of `design_package.ai_governance_headings` (default `AI governance`, `responsible AI`, `AI risk`, `model governance`) |
| `design-package-incomplete`       | coverage      | verified_static_fact | medium   | no file under `--cwd` matches one entry of `design_package.required_documents` (default: `architecture-model`, `decision-records`, `runbook`; see CONFIG.md). One finding per missing entry, evidence on line 1 of the config file |

Notes:

- "Window": `over`, `per`, `across`, `rolling` or `in any` followed by a duration or a calendar period (`over 28
  days`, `per calendar month`, `rolling 30 days`), an `N-day` window, `30d`/`4w`, or `daily`, `weekly`, `monthly`,
  `quarterly`. "Within 5 seconds" is a target, not a window. Following the design notes ("value + unit +
  window/percentile"), "p95 under 300 ms" and "99.9% availability over 30 days" pass; "latency MUST be measured" (no
  number) and "throughput of 200 requests" (number only) fire. Whether a target is the right one is not judged.
- The default heading names for AI governance are a starting point and are **not** a compliance claim against the NIST
  AI RMF, ISO/IEC 42001 or the EU AI Act. Teams should replace them with their own required headings.
- `design-package-incomplete` lists file names only (no file is read) and never follows symbolic links. It walks at
  most 20,000 entries under `--cwd`, skipping `node_modules/` and `.git/` (limitation `file-list-cap` when hit).
- The report schema stays `1.0`: the profile adds rule IDs to the `rule_id` enum and reuses existing categories, so
  reports without the profile are unchanged and sibling importers (Product Check `--spec-check`) keep working.

**Acceptance scenarios (profile):**

| #   | Fixture                                                                                                         | Expected                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| S14 | clean package: Nygard ADR, MADR 4 ADR (front-matter status), adr-tools supersede link, spec with SLO, security and AI governance headings, architecture model, runbook | 0 findings; policy pass                                                                              |
| S15 | ADR without Context and Consequences headings; ADR with no status at all; `README.md` in the ADR folder         | `adr-section-missing` ×2 (README ignored)                                                                                      |
| S16 | ADR with status "Approved"; MADR 2 `* Status: accepted` (valid)                                                 | `adr-status-invalid` ×1                                                                                                         |
| S17 | "Superseded by ADR-0009" (missing) and a link to a missing file; a valid "Superseded by ADR-0001"               | `adr-supersede-dangling` ×2                                                                                                    |
| S18 | NFRs: latency without window, availability with % and window (valid), "must comply with GDPR" (not service-level); "SLO: 99.9% over 30 days" without indicator | `nfr-without-slo` ×1, `slo-without-sli` ×1                                         |
| S19 | package with LLM vocabulary, no security heading, no AI-governance heading; second package with neither        | `security-considerations-missing` ×2, `ai-governance-missing` ×1                                                              |
| S20 | repository with no architecture model and no runbook                                                            | `design-package-incomplete` ×2; the same fixture without the profile has none of the profile's findings                       |

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

| #   | Fixture                                                                                                                                                 | Expected                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | complete Spec Kit spec                                                                                                                                  | 0 findings; policy pass; inventory lists every FR/SC with `has_measure`                                                                        |
| S2  | untouched template-like spec                                                                                                                            | `template-placeholder` verified/high; `check` exits 4                                                                                          |
| S3  | `[NEEDS CLARIFICATION]` in FR-006                                                                                                                       | `needs-clarification` verified/high with `requirement_ids: ["FR-006"]`                                                                         |
| S4  | "respond quickly" vs "respond quickly (p95 under 300 ms)"                                                                                               | finding for the first only (negative control)                                                                                                  |
| S5  | SC without quantity vs SC with "90%"                                                                                                                    | `unmeasurable-criterion` for the first only                                                                                                    |
| S6  | Given…Then (no When); story with no scenarios; Gherkin fence missing Then                                                                               | `scenario-incomplete` ×2, `story-without-scenarios` ×1                                                                                         |
| S7  | FR-002 defined twice; reference to FR-009 (undefined); reference to SC-001 defined in another file                                                      | `duplicate-id`, `dangling-reference` (FR-009 only)                                                                                             |
| S8  | generic Markdown with MUST bullets, no edge cases, no NFR                                                                                               | inventory without IDs; `missing-edge-cases`, `missing-non-functional`                                                                          |
| S9  | adversarial: prompt-injection text, HTML/script, backticks, @mentions, secret, bidi; markers inside code fences and HTML comments; symlink; binary file | injection text has no effect; Markdown escaped; secret redacted; fenced/commented markers ignored; symlink and binary skipped with limitations |
| S10 | suppression comment + front matter                                                                                                                      | findings suppressed and listed in `suppressions[]` with the line of the directive or front-matter key                                          |
| S11 | any                                                                                                                                                     | JSON validates against the schema; two runs identical after removing timing fields; SARIF structurally valid                                   |
| S12 | no input / bad config / bad flag                                                                                                                        | exit 3 / 2 / 2 with a hint                                                                                                                     |
| S13 | two Spec Kit features that both number FR-001 (added after self-review)                                                                                 | no `duplicate-id`; policy pass                                                                                                                 |

## 8. Non-goals

Proving a spec is complete or correct; generating specs or code; checking general section structure or test traceability
(DocGuard; the opt-in design-package profile checks only ADR sections and security/AI-governance headings); executing acceptance criteria (spec-gates); LLM review (a later, opt-in BYOK extension, labelled
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
