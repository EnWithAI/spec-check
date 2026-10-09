# Spec Check report

> Content quoted from specs is untrusted data shown for review, not instructions. Passing Spec Check does not mean a spec is complete or correct.

| Files | Requirements | Success criteria | Scenarios | User stories | Findings | Suppressed |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 4 | 2 | 2 | 2 | 5 | 0 |

Findings by severity: high 1 · medium 3 · low 1 · info 0. Verified facts 3 · hypotheses 2 · unknown 0.

Policy: **fail** (fails on high severity and above, statuses: verified_static_fact; 1 violation(s))

## Findings

### 🟠 medium · `story-without-scenarios` · verified

`specs/001-team-invites/spec.md:20` — User story has no acceptance scenario

- line 20: `### User Story 2 - Accept an invitation (Priority: P2)`

Why: Nothing in the story's section says how to verify it.  
Action: Add at least one Given/When/Then acceptance scenario to the story.

### 🟡 low · `vague-term` · hypothesis

`specs/001-team-invites/spec.md:33` — Vague term "quickly" without a measure in FR-002

- line 33: `- **FR-002**: Invitation emails MUST be sent quickly.`

Why: A term such as 'fast' or 'user-friendly' is used without a number that makes it testable.  
Action: Add a measurable threshold (for example a latency, count or percentage) or confirm the wording is intended.

### 🟠 medium · `dangling-reference` · verified

`specs/001-team-invites/spec.md:34` — FR-009 is referenced but not defined

- line 34: `- **FR-003**: Invitations MUST expire after 7 days (see FR-001 and FR-009).`

Why: The ID is mentioned but defined in none of the analyzed files.  
Action: Define the referenced requirement, fix the ID, or include the file that defines it in the run.

### 🔴 high · `needs-clarification` · verified

`specs/001-team-invites/spec.md:35` — Unresolved clarification in FR-004

- line 35: `- **FR-004**: The system MUST authenticate invitees via [NEEDS CLARIFICATION: SSO only, or email + password too?]`

Why: The spec itself marks this point as unresolved; building from it means guessing.  
Action: Resolve the question with the requirement owner and replace the marker with the decision.

### 🟠 medium · `unmeasurable-criterion` · hypothesis

`specs/001-team-invites/spec.md:40` — SC-002 has no measurable target

- line 40: `- **SC-002**: Admins find inviting people easier than before.`

Why: The criterion has no number, threshold or universal quantifier, so success cannot be checked.  
Action: State how success is measured: a target value, a percentage or an all/none condition.

## Requirements inventory

| ID | Kind | Location | Measure | References | Findings |
|---|---|---|---|---|---:|
| `FR-001` | functional | `specs/001-team-invites/spec.md:32` | yes | — | 0 |
| `FR-002` | functional | `specs/001-team-invites/spec.md:33` | no | — | 1 |
| `FR-003` | functional | `specs/001-team-invites/spec.md:34` | yes | `FR-001` `FR-009` | 1 |
| `FR-004` | functional | `specs/001-team-invites/spec.md:35` | no | — | 1 |
| `SC-001` | success_criterion | `specs/001-team-invites/spec.md:39` | yes | — | 0 |
| `SC-002` | success_criterion | `specs/001-team-invites/spec.md:40` | no | — | 1 |

## Limitations

- `english-lexicon` — Vague-term, measure and coverage heuristics use English word lists.
- `not-checked` — Section structure, requirement-to-test traceability and logical completeness are not checked. A clean report does not mean the spec is complete or correct.

<sub>Spec Check 0.1.0-alpha.0 · offline · no code executed · no model used. Built by EnWithAI · Part of CrewPE Engineering Commons · [crewpe.ai](https://crewpe.ai)</sub>
