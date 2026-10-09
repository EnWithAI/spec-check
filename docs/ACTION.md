# GitHub Action

`action.yml` is a composite action that runs the built Spec Check (`dist/action/main.js`) with the runner's Node.js.
Spec Check has no runtime dependencies, so nothing is installed.

## Inputs and outputs

| Input               | Default             |                                                                                                                                                             |
| ------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paths`             | (config `include`)  | Newline-separated files/directories, relative to `working-directory`. Absolute paths and `..` are rejected.                                                 |
| `working-directory` | `.`                 | Base directory for paths and the config.                                                                                                                    |
| `config-path`       | `.spec-check.json`  | Config file relative to `working-directory`; defaults are used when it does not exist.                                                                      |
| `output-dir`        | `spec-check-report` | Where `spec-check-report.{json,md,sarif}` are written.                                                                                                      |
| `fail-on-policy`    | `false`             | `true` fails the step (exit 4) on a policy failure. Otherwise a warning annotation is emitted.                                                              |
| `on-error`          | `auto`              | Tool/input errors: `auto` = fail when `fail-on-policy` is true (fail-closed), else warn (fail-open); `fail`; `warn`. Usage errors (bad inputs) always fail. |
| `excerpts`          | `true`              | Quote offending lines.                                                                                                                                      |

Outputs: `report-json`, `report-markdown`, `report-sarif`, `findings`, `high-findings`, `policy` (`passed`/`failed`),
`status` (`ok`/`error`).

## Security model

- Trigger on `pull_request` with `permissions: contents: read`. **Never** use `pull_request_target` with this action:
  it would run with a write token on untrusted content for no benefit, because Spec Check needs no secrets.
- Inputs reach the program via environment variables, never shell interpolation (enforced by `test/action.test.ts`).
- The program reads Markdown files and writes three report files plus the job summary. It starts no processes and
  makes no network calls.
- Fork pull requests behave the same as same-repository ones (read-only token, no secrets).
- Spec text is untrusted: the Markdown summary escapes it and neutralizes `@mentions`.
- A PR can change its own config and workflow. For a required check, protect `.spec-check.json` and `.github/` with
  CODEOWNERS.

## Optional: code-scanning alerts

Upload the SARIF file in a separate step that you add, with `security-events: write` on that job only:

```yaml
permissions:
  contents: read
  security-events: write
steps:
  # … checkout + spec-check …
  - uses: github/codeql-action/upload-sarif@<sha>
    with:
      sarif_file: spec-check-report/spec-check-report.sarif
```

Code scanning from fork PRs is limited by GitHub's permission model; the report artifact and job summary still work.

## Testing status

The runner logic is unit-tested in-process (`test/action.test.ts`). The CI self-test job runs the action on GitHub's
runners; it has **not been executed yet** because no remote repository exists (publication gate).
