# Changelog

All notable changes are documented here. The format follows Keep a Changelog; versions follow SemVer (pre-1.0:
minor versions may break the report schema, which carries its own `schema_version`).

## Unreleased

## 0.1.0-alpha.1 — 2026-10-10

Documentation-only release, so the npm page shows the current project information. No code or report changes.

- Maintainer and security contact: Koushik Ramani (@aiwithrk), EnWithAI Technologies; contact hello@enwithai.com.
- GitHub private vulnerability reporting enabled and documented in SECURITY.md.

## 0.1.0-alpha.0 — 2026-10-10 (published to npm)

First alpha.

- `spec-check analyze|check|rules|schema` with Markdown, JSON (schema 1.0) and SARIF 2.1.0 output.
- 12 rules: `needs-clarification`, `template-placeholder` (Spec Kit 1.1.2 exact placeholders + generic hypothesis),
  `open-marker`, `vague-term`, `unmeasurable-criterion`, `scenario-incomplete` (inline and Gherkin),
  `story-without-scenarios`, `missing-edge-cases`, `missing-non-functional`, `duplicate-id`, `dangling-reference`,
  `missing-owner` (opt-in).
- Requirements inventory with references and per-item findings.
- Default policy blocks only verified high-severity findings; configurable via `.spec-check.json`.
- Visible suppressions (front matter and next-line comments).
- Composite GitHub Action (report-only by default, explicit fail-open/fail-closed).
- Zero runtime dependencies; offline; no code execution.
