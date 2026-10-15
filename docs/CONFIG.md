# Configuration

Spec Check reads `.spec-check.json` from `--cwd` (or the file given with `--config`). The config is **data only**:
JSON, strictly validated, unknown keys rejected, no JavaScript and no regular expressions. Invalid config exits 2.
A complete example: [`.spec-check.example.json`](../.spec-check.example.json).

| Key                           | Default                                                                            | Meaning                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `include`                     | `["specs/*/spec.md"]`                                                              | Globs (`*`, `**`, `?`) used when no paths are passed.                                                       |
| `exclude`                     | `[]`                                                                               | Globs removed from the input set (also applies to explicit paths).                                          |
| `id_prefixes`                 | `FR`, `REQ` → functional · `NFR` → non_functional · `SC`, `AC` → success_criterion | Requirement ID prefixes (1–10 upper-case letters) and their kind. Replaces the default map.                 |
| `rules`                       | `{}`                                                                               | Per rule: `"off"` (listed in `run_metadata.disabled_rules`) or `{ "severity": "high\|medium\|low\|info" }`. |
| `fail_on.severity`            | `"high"`                                                                           | Minimum severity that fails `check`; `"never"` disables blocking.                                           |
| `fail_on.statuses`            | `["verified_static_fact"]`                                                         | Statuses that can fail `check`. Add `"hypothesis"` to let heuristics block.                                 |
| `require_owner`               | `false`                                                                            | Enables `missing-owner` (front matter `owner:` or an `**Owner**:` line).                                    |
| `vague_terms.add` / `.remove` | `[]`                                                                               | Plain words added to or removed from the vague-term list.                                                   |
| `excerpts`                    | `true`                                                                             | Quote offending lines (also `--no-excerpts`).                                                               |
| `profile`                     | `"default"`                                                                        | `"design-package"` enables the eight design-package rules (below).                                          |
| `design_package`              | see below                                                                          | Settings of the design-package profile; rejected unless `profile` is `"design-package"`.                    |

## Design-package profile

Opt-in rules for the documents that make up a design package: ADRs, service-level targets, and whether security and
AI governance are addressed ([SPEC.md §5a](SPEC.md)). They check that sections exist, not whether their content is
good. Heading and status words are plain words, matched case-insensitively.

| `design_package.` key    | Default                                                             | Meaning                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `adr_paths`              | `doc/adr/*.md`, `docs/adr/*.md`, `docs/decisions/*.md`              | ADR globs. Files here whose name starts with a number are ADRs; all files here are left out of the package rules. Added to `include`.  |
| `adr_sections`           | `context`, `decision`, `consequences`                               | Headings every ADR needs (a heading that starts with the word counts, so MADR's "Decision Outcome" passes). Status is always required. |
| `adr_statuses`           | `proposed`, `accepted`, `rejected`, `deprecated`, `superseded`      | Allowed first word of the ADR status.                                                                                                  |
| `security_headings`      | `security`, `threat`                                                | A heading containing one of these satisfies `security-considerations-missing`.                                                         |
| `ai_governance_headings` | `ai governance`, `responsible ai`, `ai risk`, `model governance`    | A heading containing one of these satisfies `ai-governance-missing`. Not a compliance claim; use your organization's headings.         |
| `required_documents`     | `architecture-model`, `decision-records` (= `adr_paths`), `runbook` | `{ "name": ["glob", …] }`. Replaces the defaults; `{}` turns the check off. Only file names are listed; nothing is read.               |

Default `required_documents` globs: `architecture-model`: `**/workspace.dsl`, `**/workspace.json`, `**/*.calm.json`,
`docs/architecture/**`; `runbook`: `**/runbook*.md`, `**/runbooks/**`, `docs/operations/**`.

```json
{
  "profile": "design-package",
  "include": ["specs/*/*.md"],
  "design_package": { "required_documents": { "architecture-model": ["docs/architecture/workspace.dsl"] } }
}
```

A design package is the set of analyzed non-ADR files in one directory, so set `include` to cover every document of a
Spec Kit feature (`specs/*/*.md`), not only `spec.md`.

## Per-file controls

Front matter (flat `key: value` lines only):

```markdown
---
owner: payments-team
spec_check_disable: missing-non-functional, vague-term
---
```

Next-line suppression (applies to findings whose first evidence line is the next non-blank line):

```markdown
<!-- spec-check-disable-next-line vague-term -->
```

Every suppression is listed in the report (`suppressions[]`) with its line and source. Unknown rule IDs in
directives are reported as the `unknown-suppression` limitation.

## Policy guidance

Keep blocking for structural facts and let heuristics inform. A team that wants stricter gates can opt in:

```json
{ "fail_on": { "severity": "medium", "statuses": ["verified_static_fact", "hypothesis"] } }
```

A pull request can edit its own `.spec-check.json`. If `check` gates merges, protect the config and `.github/` with
CODEOWNERS and branch protection.
