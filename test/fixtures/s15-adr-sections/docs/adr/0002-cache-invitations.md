# 2. Cache invitations

## Context

Lookups are repeated.

## Decision

Cache them for 5 minutes.

## Consequences

Stale reads for up to 5 minutes.
