# Security policy

## Supported versions

Only the latest `0.x` alpha receives fixes.

## Reporting a vulnerability

Security contact: **Koushik Ramani** ([@aiwithrk](https://github.com/aiwithrk)), maintainer, EnWithAI Technologies ·
[hello@enwithai.com](mailto:hello@enwithai.com) (if you cannot use GitHub's private reporting).

Please **do not open a public issue**. Use GitHub's private vulnerability reporting ("Report a vulnerability" on the
Security tab). Include the Spec Check version, the command and a minimal synthetic
spec. Never include real secrets or proprietary documents. We aim to acknowledge within 5 business days.

## Security properties Spec Check is designed to keep

- It never executes anything: no child processes, no `eval`, no dynamic imports, no JS config, no acceptance-criteria
  execution.
- It never uses the network and has no telemetry. No model or paid API is used.
- It reads only the Markdown files you point it at (symlinks are never followed) and writes only the report you
  request with `--output` (or the Action's report directory).
- Quoted spec lines are capped, secret-redacted and escaped; `--no-excerpts` disables quoting.
- The GitHub Action needs only `contents: read` and must not be used with `pull_request_target`.

A violation of any of these is a security bug. See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).
