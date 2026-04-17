# Archive Delta Sync Report (2026-02-27)

## Scope

- Target: `openspec/changes/archive/*/specs/*/spec.md`
- Goal: ensure all archived delta capabilities are represented in main `openspec/specs/*`

## Method

```bash
archive_specs=$(find openspec/changes/archive -type f -path '*/specs/*/spec.md' | sed -E 's#^.*/specs/([^/]+)/spec.md$#\1#' | sort -u)
main_specs=$(find openspec/specs -mindepth 1 -maxdepth 1 -type d | sed 's#.*/##' | sort -u)
comm -23 <(echo "$archive_specs") <(echo "$main_specs")
```

## Result Before Sync

Missing capabilities in main specs:

- `conversation-lifecycle-contract`
- `opencode-chat-layout`
- `opencode-mode-ux`

## Actions Applied

Added the following canonical spec files:

- `openspec/specs/conversation-lifecycle-contract/spec.md`
- `openspec/specs/opencode-chat-layout/spec.md`
- `openspec/specs/opencode-mode-ux/spec.md`

## Result After Sync

Re-run same command:

- no missing capability output
- archive delta capability coverage in main specs: complete

## Notes

- This sync only covers capability existence/representation.
- Semantic merge conflicts across versions should be handled by change-level review before archive.
