# Feature Specification: Team invitations

**Owner**: platform-team

## User Scenarios & Testing

### User Story 1 - Invite a teammate (Priority: P1)

An admin invites a teammate by email address.

**Acceptance Scenarios**:

1. **Given** an admin on the members page, **When** they invite a valid address, **Then** the invitee receives one email within 60 seconds.
2. **Given** an address that is already a member, **When** the admin invites it, **Then** the request is rejected with "Already a member".

### Edge Cases

- An invitation link older than 7 days is rejected with an error that names the expiry.

## Requirements

### Functional Requirements

- **FR-001**: System MUST send one invitation email per invited address.
- **FR-002**: System MUST reject invitations to existing members.

### Non-Functional Requirements

- **NFR-001**: Invitation API latency MUST stay under 300 ms at p95 over 28 days.
- **NFR-002**: Availability SLO: 99.9% of invitation requests succeed per calendar month.

## Success Criteria

- **SC-001**: 99% of invitation emails arrive within 60 seconds.
