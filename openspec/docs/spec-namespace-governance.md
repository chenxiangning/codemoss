# Spec Namespace Governance

## Decision

Effective date: 2026-02-27

- Canonical namespace for Spec Hub domain: `spec-hub-*`
- Compatibility namespace: `spec-platform-*` (legacy only, no new requirements)

## Why

- Avoid split ownership and duplicate capability evolution.
- Keep runtime/workbench/adapter/environment semantics under one prefix.
- Reduce ambiguity when creating new changes and syncing delta specs.

## Mapping

- `spec-platform-workbench-ui` -> `spec-hub-workbench-ui`
- `spec-platform-adapter-openspec` -> `spec-hub-adapter-openspec`
- `spec-platform-runtime` -> `spec-hub-runtime-state`
- `spec-platform-speckit-hook` -> `spec-hub-speckit-minimal-hook`
- `spec-platform-environment-management` -> `spec-hub-environment-doctor`

## Authoring Rules

- New change proposals MUST target canonical `spec-hub-*` capabilities.
- Legacy `spec-platform-*` specs are frozen except:
  - typo fixes
  - link/metadata corrections
  - explicit deprecation notes
- If a legacy capability needs behavior change, create/update the canonical `spec-hub-*` spec and add cross-reference in change artifacts.

## Archive Sync Rules

- During `openspec-sync` or archive review, check whether new delta capabilities introduce non-canonical `spec-platform-*` names.
- If introduced, block archive until capability is either:
  - renamed to canonical namespace, or
  - explicitly approved as legacy compatibility exception.
