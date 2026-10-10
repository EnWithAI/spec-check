# Spec Check

**Is each requirement in this spec clear and verifiable enough to build from? Offline, deterministic, and it never runs anything.**

Spec Check reads Markdown specs (with first-class support for [GitHub Spec Kit](https://github.com/github/spec-kit) `spec.md` files) and points at the exact lines a person or an AI coding agent would have to guess about:

- unresolved `[NEEDS CLARIFICATION]` markers and template placeholders left in the spec;
- `TBD`/`TODO` in requirements, criteria and scenarios;
- vague terms such as "fast" or "user-friendly" with no number attached;
- success criteria with no measurable target;
- acceptance scenarios missing Given, When or Then, and user stories with no scenario at all;
- specs with no edge or negative cases, or no non-functional constraint;
- duplicate requirement IDs and references to IDs that are defined nowhere.

Every finding has a `status`: `verified_static_fact` (a structural fact, such as a marker that is present) or `hypothesis` (a word-list judgement a human should confirm). Each also has the file and line, a short quote of the line, and a `recommended_human_action`. You also get a requirements inventory (every `FR-`/`NFR-`/`SC-` item, its references and its findings) as JSON, Markdown or SARIF. There is no 0–100 quality score.

> Status: **alpha** (`0.1.0-alpha.0`, report schema 1.0). Not yet published to npm; see [Install](#install).

## 60-second demo

Requires Node.js 22, 24 or ≥ 26. No runtime dependencies.

```bash
git clone https://github.com/enwithai/spec-check.git spec-check && cd spec-check
npm ci --ignore-scripts && npm run build
cd examples/demo && node ../../dist/cli/main.js check
```

The exit code is `4`: the demo spec has an unresolved clarification, which the default policy blocks. The report matches [`examples/demo/output/spec-check-report.md`](examples/demo/output/spec-check-report.md) byte for byte (JSON: [`.json`](examples/demo/output/spec-check-report.json), SARIF: [`.sarif`](examples/demo/output/spec-check-report.sarif)). An excerpt:

```text
### 🔴 high · `needs-clarification` · verified
`specs/001-team-invites/spec.md:35` — Unresolved clarification in FR-004

### 🟡 low · `vague-term` · hypothesis
`specs/001-team-invites/spec.md:33` — Vague term "quickly" without a measure in FR-002

### 🟠 medium · `dangling-reference` · verified
`specs/001-team-invites/spec.md:34` — FR-009 is referenced but not defined
```

## Install

```bash
npm install --global @enwithai/spec-check@alpha
spec-check --help
```

Alpha releases are published under the `alpha` dist-tag. To build from source instead:
`git clone https://github.com/enwithai/spec-check.git && cd spec-check && npm ci --ignore-scripts && npm run build`.

Uninstall with `npm uninstall --global @enwithai/spec-check`. Spec Check stores nothing outside the report files you ask for.

## Usage

```bash
spec-check check                          # specs/*/spec.md (Spec Kit layout), Markdown to stdout, policy applied
spec-check check docs/requirements        # any Markdown files or directories
spec-check analyze --format json --output spec-check.json   # report only, never fails on findings
spec-check check --format sarif --output spec-check.sarif   # for code-scanning tools
spec-check rules                          # the rule catalog
```

| Exit code | Meaning                                   |
| --------- | ----------------------------------------- |
| 0         | OK (`check`: policy passed)               |
| 1         | Internal error                            |
| 2         | Usage or configuration error              |
| 3         | Input error (no spec found, path missing) |
| 4         | Policy failure (`check` only)             |

**Default policy:** `check` fails only on **verified, high-severity** findings: unresolved clarifications, template placeholders and duplicate IDs. Hypotheses inform and never block unless you opt in. See [docs/CONFIG.md](docs/CONFIG.md) to change the policy, re-rank or disable rules, add requirement ID prefixes or vague terms, or require an owner.

**Suppressing a finding** is always visible in the report:

```markdown
<!-- spec-check-disable-next-line vague-term -->

- **FR-002**: The editor MUST feel fast.
```

or for a whole file, in front matter: `spec_check_disable: missing-non-functional`.

## GitHub Action

```yaml
on: pull_request
permissions:
  contents: read
jobs:
  spec-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha> # pin by SHA
        with:
          persist-credentials: false
      - uses: enwithai/spec-check@<release-sha> # placeholder until published
        with:
          fail-on-policy: "false" # report only (default)
```

The Action writes `spec-check-report/spec-check-report.{json,md,sarif}` and a job summary. It needs only `contents: read`. Uploading the SARIF file to code scanning is optional and needs `security-events: write` in a separate step that you add. See [docs/ACTION.md](docs/ACTION.md).

## What Spec Check does not do

- It does not prove a spec is complete or correct. A clean report means none of these rules fired, nothing more.
- It does not check section structure or requirement-to-test traceability. [DocGuard](https://github.com/raccioly/docguard) already does that; use both.
- It does not execute acceptance criteria and does not call any AI model. Optional, opt-in model review may come later and will be labelled as hypothesis.
- Word lists are English only. Markdown support is a documented subset (no setext headings or HTML blocks).

## Privacy and security

No network access, no telemetry, no child processes, no `eval`. It reads the Markdown files you point it at, never follows symlinks, and writes only the report you request. Spec text is treated as untrusted data. Quoted lines are capped at 160 characters, have token-like secrets redacted and are escaped for Markdown. Use `--no-excerpts` to turn quoting off. See [SECURITY.md](SECURITY.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Documentation

[Specification](docs/SPEC.md) · [Configuration](docs/CONFIG.md) · [GitHub Action](docs/ACTION.md) · [Architecture](docs/ARCHITECTURE.md) · [Threat model](docs/THREAT_MODEL.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

## License

MIT © EnWithAI Technologies. Not affiliated with or endorsed by GitHub or the Spec Kit maintainers.

---

<sub>**Check the spec. Check the impact. Check the outcome.** Spec Check is one of three checks, with
[Impact Check](https://github.com/enwithai/impact-check) and [Outcome Check](https://github.com/enwithai/outcome-check).</sub>

<sub>An **EnWithAI Engineering Commons** initiative. Developed and maintained by EnWithAI Technologies, contributing to
open, verifiable and accountable AI-assisted software engineering. Part of the broader [CrewPE](https://crewpe.ai)
engineering ecosystem. Spec Check is independently usable and does not require CrewPE. Enterprise advisory and
transformation perspectives are supported through [NetworkGain Consulting](https://networkgain.com).
Attribution: [ATTRIBUTION.md](ATTRIBUTION.md) · Notices: [NOTICE.md](NOTICE.md) · Trademarks:
[TRADEMARKS.md](TRADEMARKS.md) · References: [REFERENCES.md](REFERENCES.md).</sub>
