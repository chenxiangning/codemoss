# Implementation Alignment

## Capability: workspace-home-shadcn-ux

- Implementation:
    - `src/features/workspaces/components/WorkspaceHome.tsx` implements Hero/Guide/Recent three-section IA.
    - `src/features/workspaces/components/WorkspaceHomeSpecModule.tsx` uses semantic card/button structure for
      OpenSpec + Spec-kit entries.
    - `src/styles/workspace-home.css` defines light/dark-equivalent visual semantics for status and danger actions.
- Verification:
    - `src/features/workspaces/components/WorkspaceHome.test.tsx`
        - `renders hero, guide, and recent sections with reachable primary CTAs`

## Capability: workspace-home-opencode-entry

- Implementation:
    - `WorkspaceHome.tsx` keeps OpenCode in engine options and reuses existing start/continue handlers.
- Verification:
    - `WorkspaceHome.test.tsx`
        - `falls back to opencode when it is the only installed engine`
        - `continues the latest conversation from hero CTA`

## Capability: workspace-recent-conversations-bulk-management

- Implementation:
    - `WorkspaceHome.tsx` keeps management mode, two-step confirmation, partial-failure retention, and anti-reentry
      disable logic.
- Verification:
    - `WorkspaceHome.test.tsx`
        - `deletes selected conversations only on second confirmation click`
        - `cancels armed delete state without deleting`
        - `keeps failed threads selected after partial delete`

## Validation Commands

- `pnpm vitest run src/features/workspaces/components/WorkspaceHome.test.tsx`
- `pnpm tsc --noEmit`
