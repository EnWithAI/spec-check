---
status: accepted
date: 2026-09-10
---
# Use PostgreSQL for invitations

## Context and Problem Statement

Invitations need durable storage with transactional writes.

## Decision Outcome

Chosen option: PostgreSQL, because the team already operates it.

### Consequences

* Good, because backups and recovery are already in place.
