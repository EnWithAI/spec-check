# Implementation plan: Team invitations

## Summary

Invitation emails are drafted by a large language model (LLM) and checked by a template filter before sending.

## Security considerations

Invitation tokens are single-use and expire after 7 days.

## AI governance

Intended use: drafting invitation text only. A fixed template is used when the model is unavailable.
