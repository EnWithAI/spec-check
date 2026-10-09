# Feature Specification: Sign-in

## User Scenarios & Testing

### User Story 1 - Sign in (Priority: P1)

A member signs in to see their dashboard.

**Acceptance Scenarios**:

1. **Given** a registered member, **When** they submit valid credentials, **Then** the dashboard opens.
2. **Given** a registered member, **When** they submit a wrong password 5 times, **Then** the account is locked for 15 minutes.

### Edge Cases

- An expired session redirects to the sign-in page with an error message.

## Requirements

- **FR-005**: System MUST lock an account after 5 failed attempts within 10 minutes.
- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain sign-in audit logs for 90 days.

## Success Criteria

- **SC-001**: 99% of valid sign-ins complete in under 2 seconds.
