# Feature Specification: Team invitations

**Feature Branch**: `001-team-invites`

**Created**: 2026-09-15

**Status**: Draft

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Invite a teammate (Priority: P1)

A workspace admin invites a colleague by email.

**Acceptance Scenarios**:

1. **Given** an admin on the Members page, **When** they invite `sam@example.com`, **Then** Sam receives an email with a link valid for 7 days.
2. **Given** an admin, **When** they invite an address that is already a member, **Then** the invitation is rejected with "Already a member".

### User Story 2 - Accept an invitation (Priority: P2)

The invited person opens the link and joins the workspace.

### Edge Cases

- What happens when the link has expired? The page explains that the invitation expired and offers to request a new one.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Admins MUST be able to invite up to 50 people at once.
- **FR-002**: Invitation emails MUST be sent quickly.
- **FR-003**: Invitations MUST expire after 7 days (see FR-001 and FR-009).
- **FR-004**: The system MUST authenticate invitees via [NEEDS CLARIFICATION: SSO only, or email + password too?]

## Success Criteria _(mandatory)_

- **SC-001**: 95% of invitation emails arrive within 2 minutes.
- **SC-002**: Admins find inviting people easier than before.
