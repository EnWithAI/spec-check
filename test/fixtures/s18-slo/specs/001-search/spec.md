# Feature Specification: Search

## User Scenarios & Testing

### User Story 1 - Search members (Priority: P1)

An admin searches members by name.

**Acceptance Scenarios**:

1. **Given** 3 members named Ana, **When** the admin searches "Ana", **Then** 3 results are listed.

### Edge Cases

- A query longer than 200 characters is rejected with an error.

## Requirements

- **FR-001**: System MUST match member names by prefix.
- **NFR-001**: Search latency MUST be measured and reported.
- **NFR-002**: Search availability MUST be 99.9% over 30 days.
- **NFR-003**: Search MUST comply with GDPR erasure requests.

## Service levels

The team SLO is 99.9% over 30 days.

## Security considerations

Queries are logged without personal data.
