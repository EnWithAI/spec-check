# CLAUDE.md — Spec Check repository conventions

These conventions apply inside this repository. They never override the CrewPE Engineering Commons launch pack
(`../START_HERE.md`, `../MASTER_PROMPT.md`, `../PHASE_GATES.md`) or the user's explicit instructions.

## Commands

- Install: `npm ci --ignore-scripts`
- Full gate: `npm run check:all` (typecheck → lint → format check → build → tests with coverage ≥ 80% lines)
- Licenses: `node scripts/license-audit.mjs --all` (there are no production dependencies)
- Sample outputs: `npm run build && node scripts/generate-demo-output.mjs` (commit when report output changes)

## Scope

Deterministic, offline spec verifiability checks for Markdown / Spec Kit specs, plus a GitHub Action. Out of scope for
alpha: LLM review, section-structure or traceability checks (DocGuard), executing acceptance criteria, non-English
lexicons, scores, hosted services, telemetry.

## Invariants (tests enforce most of these)

- No network modules, `child_process`, `vm`, `eval` or dynamic `import()` in `src/` (`test/security.test.ts`).
- No runtime dependencies.
- Findings need evidence, a status and a recommended action. Only structural facts may be `verified_static_fact`.
- Output is deterministic except `generated_at`/`duration_ms`; arrays sorted; paths relative to `--cwd`.
- Spec-derived strings are redacted and escaped before rendering. Excerpts are ≤ 160 chars.
- Fixtures are synthetic only. Rule changes start with a failing expectation.

## Permission gates

Local commits on the work branch are fine. **Pushing, creating remotes/repos, publishing to npm, opening external
issues/PRs, or enabling third-party services requires explicit user approval for that specific action.**
