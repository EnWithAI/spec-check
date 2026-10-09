# Feature Specification: Order metrics

## Requirements

- **NFR-001**: The orders API MUST answer within 200 ms at p95.

## Success Criteria

- **SC-001**: 99% of orders are confirmed within 1 minute.

### Edge Cases

- A failed email is retried 3 times.
