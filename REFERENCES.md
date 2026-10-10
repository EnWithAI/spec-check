# References

Sources that shaped Spec Check. Dependencies and formats we _use_ are in [ATTRIBUTION.md](ATTRIBUTION.md); this file
lists _ideas and specifications_. Listing a source does not imply its authors endorse Spec Check or are affiliated
with it. No text, diagrams or tables are reproduced.

## Research and practice

### The New SDLC With Vibe Coding: From ad-hoc prompting to Agentic Engineering

- **Authors / publisher:** Addy Osmani, Shubham Saboo, Sokratis Kartakis; Google (course material for Google's
  AI Agents Intensive on Kaggle).
- **Date:** 2026. The exact month is unconfirmed: secondary sources say May or June 2026.
- **Verification:** **the original document was not retrieved**; title, authors and context are corroborated only by
  secondary commentary.
- **What we took from it, via EnWithAI's internal SDLC addendum:** specification, context and verification as the scarce
  resources in AI-assisted development.
- **Our interpretation (EnWithAI's own proposals, not Google's):** deterministic, evidence-labelled checks of whether each requirement is observable and verifiable, with no hidden model grading.
- No quantitative claims from the paper or its commentary are used.

## Specifications and upstream projects

| Project                                                                   | Version / commit               | License | What we used                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------- |
| [GitHub Spec Kit](https://github.com/github/spec-kit)                     | v1.1.2 (`959e866`, 2026-10-07) | MIT     | Template structure and placeholders; `/speckit.analyze`, `clarify` and `checklist` reviewed to avoid duplicating them |
| [SARIF](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) | 2.1.0                          | OASIS   | Output format                                                                                                         |
| [JSON Schema](https://json-schema.org)                                    | draft 2020-12                  | —       | Report schema                                                                                                         |

## Surveyed, not used

| Project                                                                       | Why it was reviewed                                                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [DocGuard](https://github.com/raccioly/docguard) (`docguard-cli` 0.43.0, MIT) | Overlap audit: it already checks Spec Kit structure and requirement↔test traceability, so Spec Check does not |
| spec-gates (MIT)                                                              | Overlap audit: it executes acceptance criteria, which Spec Check deliberately never does                      |
| Spec Kit community extensions catalog                                         | Overlap audit (179 extensions reviewed by name and type)                                                      |
