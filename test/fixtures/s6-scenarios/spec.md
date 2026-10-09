# Feature Specification: Password reset

## User Scenarios & Testing

### User Story 1 - Request a reset link (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a registered email, **When** the member requests a reset, **Then** a link valid for 30 minutes is emailed.
2. **Given** an unknown email, **Then** the same confirmation message is shown.

### User Story 2 - Reset from the link (Priority: P2)

The member opens the link and chooses a new password.

### User Story 3 - Expired link (Priority: P3)

```gherkin
Feature: expired links
  Scenario: Link older than 30 minutes
    Given a reset link created 31 minutes ago
    When the member opens it
    Then an "expired link" error is shown

  Scenario: Reused link
    Given a reset link that was already used
    When the member opens it
```

### Edge Cases

- A reset requested twice within 1 minute sends only one email.

## Requirements

- **FR-001**: System MUST send at most one reset email per minute per address.
- **NFR-001**: Reset links MUST expire after 30 minutes for security.
