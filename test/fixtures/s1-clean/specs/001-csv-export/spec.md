# Feature Specification: CSV export of invoices

**Feature Branch**: `001-csv-export`

**Created**: 2026-09-01

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export filtered invoices (Priority: P1)

An accountant exports the invoices currently shown in the list as a CSV file.

**Why this priority**: Month-end reconciliation depends on it.

**Independent Test**: Filter the list to one month, export, and compare the row count with the list count.

**Acceptance Scenarios**:

1. **Given** 42 invoices match the filter, **When** the accountant selects Export CSV, **Then** a file with 42 data rows and one header row downloads.
2. **Given** no invoices match the filter, **When** the accountant selects Export CSV, **Then** the export button is disabled and shows "Nothing to export".

---

### User Story 2 - Choose columns (Priority: P2)

The accountant chooses which columns appear in the export.

**Why this priority**: Different ledgers need different columns.

**Independent Test**: Deselect two columns and verify that the file omits them.

**Acceptance Scenarios**:

1. **Given** the accountant deselected "Notes", **When** they export, **Then** the file has no "Notes" column.

### Edge Cases

- What happens when an invoice note contains a comma or a line break? The value is quoted per RFC 4180.
- How does the system handle an export of more than 50,000 rows? It rejects the request with an error that names the limit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST export exactly the invoices that match the active filter.
- **FR-002**: System MUST encode files as UTF-8 with a header row.
- **FR-003**: Users MUST be able to choose the exported columns (see FR-001).
- **FR-004**: System MUST reject exports larger than 50,000 rows with an error message.

### Non-Functional Requirements

- **NFR-001**: An export of 10,000 rows MUST complete within 5 seconds at the 95th percentile.
- **NFR-002**: Exports MUST only include invoices the user is authorized to view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of exports finish in under 5 seconds.
- **SC-002**: Zero exports contain invoices outside the active filter in the acceptance test suite.

## Assumptions

- Accountants already have read access to invoices.
