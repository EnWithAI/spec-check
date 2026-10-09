# Feature Specification: sign in

## Requirements

- **FR-001**: Members MUST be able to sign in within 2 seconds.
- **FR-002**: A failed sign in attempt MUST show an error message (see FR-001).

## Success Criteria

- **SC-001**: 99% of sign in attempts succeed on the first try.

### Edge Cases

- An expired session shows an error.
