# Search

## Requirements

- **FR-001**: Search MUST respond quickly.
- **FR-002**: Search MUST respond quickly (p95 under 300 ms for 1 million documents).
- **FR-003**: The results page MUST be user-friendly and intuitive.
- **FR-004**: Invalid queries MUST return an error message naming the invalid operator.

## Success Criteria

- **SC-001**: Search latency is under 300 ms at p95.

### Edge Cases

- An empty query returns an error message.
