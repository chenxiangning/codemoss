## Acceptance Log (2026-03-06)

### Scope
- workspace-filetree-root-node

### Automated Verification
1. `npm run -s test:watch -- src/features/files/components/FileTreePanel.run.test.tsx --run`
   - Result: pass (`19` tests)
   - Covers: workspace root node rendering/expand-restore, special directory lazy loading, top tool row layout, root context non-open action contract, preview read flow, sticky/list structure split

2. `npm run -s typecheck`
   - Result: pass

3. `cd src-tauri && cargo test workspaces::files -- --nocapture`
   - Result: pass
   - Covers: special directory detection + workspace relative path normalization guard (`empty`, `traversal`, `.git`)

### Notes
- 4.1 multi-tab contract: validated by component-level non-open root menu action regression (no open action side effect).
- 4.2 preview/file-open main chain: validated by existing file-open tests and explicit preview read-flow regression.
- 4.4 sticky behavior: validated by structural separation (`.file-tree-top-zone` vs `.file-tree-list`) plus root collapse/expand interaction regression.
