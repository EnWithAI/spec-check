# Attribution and provenance

## Publisher

- **Project:** Spec Check (`@enwithai/spec-check`), formerly developed under the working name SpecGuard.
- **Commons:** EnWithAI Engineering Commons. Philosophy: _engineering intent must be explicit, testable and verifiable before implementation._
- **Copyright holder:** EnWithAI Technologies (as stated in [LICENSE](LICENSE)).
- **License:** MIT. It applies to all code, documentation, schemas and examples in this repository.
- **Maintainers:** EnWithAI Technologies. Individual maintainers will be listed at publication.
- **Security issues:** see [SECURITY.md](SECURITY.md).

## Development provenance

Spec Check was written for this repository. Spec Check has **no runtime dependencies**. It was developed with substantial AI assistance (Claude Code).
Commits carry a `Co-Authored-By` trailer, and changes were directed and accepted by the project's human sponsor. Test
fixtures and demo data are synthetic. See [NOTICE.md](NOTICE.md) for third-party material.

## Built on

| Upstream                                                                  | Version                | License | How Spec Check uses it                                                                                                                                                            |
| ------------------------------------------------------------------------- | ---------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Node.js](https://nodejs.org)                                             | 22 / 24 / ≥ 26         | MIT     | Runtime only                                                                                                                                                                      |
| [GitHub Spec Kit](https://github.com/github/spec-kit)                     | 1.1.2 (`959e866`)      | MIT     | Spec file conventions (headings, `FR-###`/`SC-###`, Given/When/Then, placeholders) that Spec Check recognises. Spec Check complements Spec Kit; it does not replace or modify it. |
| [SARIF](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) | 2.1.0 (OASIS standard) | —       | Output format                                                                                                                                                                     |

Development tools (Vitest, ESLint, typescript-eslint, Prettier, Ajv, TypeScript) are not distributed. Research and
design influences are in [REFERENCES.md](REFERENCES.md). Listing a project does not mean its maintainers endorse
Spec Check.

## Frameworks

| Framework | Owner                  | Relationship   | Note                                                                                                                                                                                                                                    |
| --------- | ---------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLEAR     | NetworkGain Consulting | `none`         | The tri-state status and rule catalog are Spec Check's own design, not a CLEAR method.                                                                                                                                                  |
| TRACE     | EnWithAI Technologies  | `not-assessed` | Spec Check inventories requirements and ties findings to requirement IDs and source lines. It deliberately does not check requirement-to-test traceability. Alignment with TRACE cannot be stated until its specification is published. |

## Ecosystem

Spec Check is independently usable. It has no dependency on CrewPE, any EnWithAI service or NetworkGain, and it never
uses the network. CrewPE is EnWithAI's enterprise engineering-lifecycle product and could consume Spec Check's JSON or SARIF report as specification-readiness evidence; no such integration
exists today. NetworkGain Consulting offers advisory and transformation services, and using Spec Check creates no
obligation to engage them.

## Not affiliated

Spec Check is not affiliated with, endorsed by or certified by GitHub, the Spec Kit maintainers, the DocGuard maintainers, OASIS, Anthropic or Google.
