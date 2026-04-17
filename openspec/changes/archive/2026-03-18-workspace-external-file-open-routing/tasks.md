## 1. Path Domain Contract

- [x] 1.1 Add a path-domain resolver that classifies file jump targets as `workspace`, `external-spec`, or `unsupported-external`.
- [x] 1.2 Keep existing workspace-relative normalization behavior unchanged for current workspace file-open flow.

## 2. Session Activity Jump Routing

- [x] 2.1 Extend `File change` jump handling to branch by path domain before invoking file read APIs.
- [x] 2.2 Route `external-spec` targets to `readExternalSpecFile` using active external spec root context.
- [x] 2.3 Show a recoverable user hint for `unsupported-external` targets without breaking panel interaction.

## 3. Cross-Platform Compatibility

- [x] 3.1 Add path comparison coverage for macOS/Linux style absolute paths and Windows drive-letter paths.
- [x] 3.2 Ensure Windows matching is case-insensitive while preserving existing workspace behavior.

## 4. Regression Guard

- [x] 4.1 Add or update tests to verify workspace file opening remains behaviorally unchanged.
- [x] 4.2 Add tests for external spec root file opening success from session activity `File change` events.
- [x] 4.3 Add tests for safe rejection and recoverable hint when path is outside both allowed roots.
