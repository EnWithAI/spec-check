# Contributing to Spec Check

Thanks for helping! Spec Check aims to stay **small, deterministic and honest** about what it knows.

## Ground rules

- Every finding needs evidence (path and lines), a `status` (`verified_static_fact` only for structural facts) and a
  `recommended_human_action`. Prefer a coverage limitation over guessing.
- Do not re-implement what Spec Kit or DocGuard already do (section structure, traceability). Do not execute
  anything from specs.
- No network access, telemetry, child processes or runtime dependencies without an issue discussing it first.
- Fixtures must be **synthetic**. Never commit real or client specs, secrets or personal data.
- Report schema changes must bump `schema_version` and update `schema/` and `src/types.ts` together.
- **Rule or lexicon changes need fixtures first:** add or update an expectation in `test/acceptance/expected/` (or a
  unit case), watch it fail, then implement.

## Development

```bash
npm ci --ignore-scripts
npm run check:all                     # typecheck, lint, format check, build, tests with coverage
node scripts/license-audit.mjs --all
node scripts/generate-demo-output.mjs # after changing report output; commit the updated samples
```

## Pull requests

- Keep PRs focused; include tests that assert behavior.
- Describe user-visible changes in `CHANGELOG.md` under "Unreleased".
- By contributing you agree your contribution is licensed under the MIT License.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
