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
