# Feature Specification: Orders

## Requirements

- **FR-001**: System MUST store each order with a unique number.
- **FR-002**: System MUST reject orders without items with an error message.
- **FR-002**: System MUST send a confirmation email within 1 minute.
- **FR-003**: Order history MUST be paginated at 50 orders per page (see FR-009 and SC-001).

### Edge Cases

- Duplicate submissions within 2 seconds create one order.
