# Release readiness — Spec Check 0.1.0-alpha.0

Date: 2026-10-09 · Branch `alpha/spec-check-0.1` · **Verdict: READY FOR HUMAN REVIEW** (not published; publication
needs explicit approval).

## Verified (commands rerun on 2026-10-09, Node v25.9.0, npm 11.12.1)

| Check                             | Command                                                                         | Result                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Full gate                         | `npm run check:all`                                                             | exit 0 — typecheck, lint, format, build; 8 files / 82 tests passed; lines 96.13%, branches 85.39%                             |
| Acceptance S1–S11 (+S13 in units) | `npx vitest run test/acceptance`                                                | all pass; expectations hand-written before implementation and observed failing first (commit `c640cc6`: 24 failed / 1 passed) |
| Licenses                          | `node scripts/license-audit.mjs` / `--all`                                      | 0 production packages; dev: MIT 39, BSD-3-Clause 1, Apache-2.0 1; disallowed 0                                                |
| Package                           | `npm pack --dry-run`                                                            | 48 files, 40.9 kB, dist + schema + docs only                                                                                  |
| Clean install                     | pack → `npm install <tgz>` in an empty dir → `npx spec-check check` on the demo | works; 1 package installed; uninstall clean                                                                                   |
| Quickstart                        | `test/quickstart.test.ts` (built CLI, separate process)                         | demo reproduces committed Markdown/JSON/SARIF byte for byte; exit 4                                                           |
| Scale                             | 1,000 files × 100 requirements                                                  | 3.0 s, ~765 MB RSS, `finding-cap` reported                                                                                    |

## Gate checklist

- [x] CLI works offline, no API key, no runtime dependencies.
- [x] Every finding has rule ID, status, severity, confidence, evidence (path + lines + redacted excerpt) and a
      recommended human action. No score.
- [x] Hypotheses never block by default; policy explicit (`fail_on`); fail-open/closed explicit (`--on-error`,
      Action `on-error`).
- [x] Adversarial fixture: injection text inert, HTML/mentions escaped, secrets redacted, bidi visible, symlink and
      binary skipped.
- [x] Sample output audited by hand for evidence accuracy (5/5 demo findings correct, none invented).
- [x] Docs: README with a 60-second demo, SPEC, CONFIG, ACTION, ARCHITECTURE, THREAT_MODEL, SECURITY, CONTRIBUTING,
      CODE_OF_CONDUCT, CHANGELOG, LICENSE (MIT), issue/PR templates, CI workflow (actions pinned by SHA).
- [ ] **Action on GitHub runners: not executed** (no remote repository; blocked by the publication gate).
- [ ] CI matrix on Node 22/24/26: not executed remotely; local run on Node 25 only.
- [ ] Trademark check for "Spec Check": not done. Unscoped npm `spec-check` belongs to an unrelated Java tool; the
      scoped name `@enwithai/spec-check` was free when checked (D-049).

## Known limitations and risks

- Word lists are English and will produce false positives and negatives (all such rules are `hypothesis`).
- Markdown is a documented subset; setext headings and HTML blocks are reported as `markdown-subset`.
- `dangling-reference` resolves across the analyzed files only; running on one file of a multi-file spec can report
  IDs defined elsewhere (medium, non-blocking).
- No requirement-to-test traceability or section-structure checks by design (DocGuard covers them).
- Memory grows with raw findings before the 5,000 cap; fine for typical repos, measured above.

## Self-review fixes made before this report

1. `duplicate-id` would have flagged every multi-feature Spec Kit repository (per-feature `FR-001`) as a blocking
   failure → `id_scope: "file"` default, `"set"` opt-in; fixture S13 written first.
2. Multi-file duplicate evidence reused one path → each location carries its own path.
3. Table-defined IDs were missed (rows joined into one paragraph) → rows split into blocks.
4. Inventory mapping was quadratic → indexed by path (5.2 s → 3.0 s, identical output).
5. A test file contained literal bidi characters → escaped, plus a Trojan Source guard test.

## Requested external actions (none taken)

Create the repository (proposed `enwithai/spec-check`, or a combined layout to be confirmed), push, run CI and the
Action self-test, publish `@enwithai/spec-check@0.1.0-alpha.0`. Each requires explicit approval.
