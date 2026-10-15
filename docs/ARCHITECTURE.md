# Architecture

```
cli/run.ts ─┐                         ┌─ report/json.ts
action/run.ts ┴─ analyze.ts ─┬─ input/discover.ts   (files: lstat, no symlinks, caps, UTF-8 check)
                             ├─ parse/markdown.ts   (front matter, comments, fences, headings, items)
                             ├─ parse/spec.ts       (requirements, IDs, references, scenarios, stories)
                             ├─ rules/rules.ts      (catalog + 12 rules) ← rules/lexicon.ts
                             ├─ rules/design.ts     (8 opt-in design-package rules; file-name listing for required documents)
                             ├─ policy.ts           (check)
                             └─ report/{markdown,sarif,escape,redact}.ts
```

- **Pure core.** Apart from reading inputs and the clock, analysis is a pure function of file contents and config.
  Output is sorted (path, line, rule, ID), and finding IDs hash the path, rule and normalized item text. So reports
  are byte-identical across runs and machines except `generated_at`/`duration_ms`.
- **Zero runtime dependencies.** A small line-based Markdown model instead of a full CommonMark parser. Specs use a
  narrow subset (headings, lists, fences, comments). Anything outside it is reported as `markdown-subset`.
  _Alternative considered:_ `micromark`/`mdast` (MIT, ~40 packages). Rejected for alpha: supply-chain surface and
  no need for full CommonMark fidelity to locate lines. Revisit if users hit the subset limits.
- **Tri-state status.** Structural facts (`verified_static_fact`) vs word-list judgements (`hypothesis`). `unknown` is
  reserved for future analyzers; no current rule emits it.
- **Policy is separate from findings.** `analyze` never fails on findings; `check` applies `fail_on`.
- **Shared contract with Impact Check:** `status`, `evidence[]` with line ranges, `recommended_human_action`,
  `coverage_limitations[]` with `code/message/paths/count`, and `run_metadata` with `network: false` and
  `model_usage: null`.
