# Feature Specification: sign out

## Requirements

- **FR-001**: Members MUST be able to sign out within 2 seconds.
- **FR-002**: A failed sign out attempt MUST show an error message (see FR-001).

## Success Criteria

- **SC-001**: 99% of sign out attempts succeed on the first try.

### Edge Cases

- An expired session shows an error.
