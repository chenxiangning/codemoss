# CLI Version Status Contract

## Scenario: CLI version probe isolates login shell startup output

### 1. Scope / Trigger

- Trigger：修改 `resolve_cli_version_status`、Claude interactive login shell probe、`CliVersionStatus` 或 `CliLifecycleHeaderActions`。
- 目标：shell startup banner、proxy notice 与 profile diagnostics 不得进入 local version，也不得影响 update state。

### 2. Signatures

- Backend：`pick_claude_version_line(output: &str) -> Option<String>`
- Backend：`resolve_cli_version_status(engine, settings) -> CliVersionStatus`
- Payload：`CliVersionStatus { localVersion, latestVersion, updateAvailable, ... }`
- Frontend：`CliLifecycleHeaderActions()`

### 3. Contracts

- Claude login shell output MAY contain arbitrary non-version lines before `command -v claude` 与 `claude -v` output。
- Version parser MUST accept a line containing `claude` + semver，或以 standalone semver token 开头的 canonical version line。
- Version parser MUST reject URLs、IP addresses、proxy notices、shell plugin diagnostics 与 arbitrary trailing lines。
- `updateAvailable=false` 只表示“没有确认更高版本”，不得单独解释为“已是最新”。
- “已是最新” MUST require non-null `localVersion`、non-null `latestVersion` 与 `updateAvailable=false`。
- Desktop header actions MUST stay right-aligned on the title row when space permits；insufficient width MAY wrap in normal flow。

### 4. Validation & Error Matrix

| 输入/状态 | 必须行为 | 禁止行为 |
|---|---|---|
| proxy banner + path + Claude version | select Claude version | select `127.0.0` from proxy URL |
| proxy banner only | `localVersion=null` / fallback probe | expose banner as version |
| local known, latest unknown | show local version only | show “已是最新” |
| local/latest known, latest > local | show target version + update action | hide update |
| local/latest equal | show “已是最新” | show update |

### 5. Good / Base / Bad Cases

- Good：`2.1.218 (Claude Code)` 被选中，前置 `http://127.0.0.1:7890` 被忽略。
- Base：纯 `2.1.218` output 仍可识别。
- Bad：对任意包含三个数字段的行调用 `extract_semver()` 并把首个 match 当版本。
- Bad：`updateAvailable ? outdated : latest`，因为 `false` 同时覆盖 registry probe failure。

### 6. Tests Required

- Rust test MUST 覆盖真实 proxy banner + path + Claude version，以及 banner-only rejection。
- Vitest MUST 覆盖 latest unknown、outdated、confirmed latest 三态。
- Required gates：focused Rust test、focused Vitest、`npm run typecheck`、focused ESLint、`git diff --check`。

### 7. Wrong vs Correct

#### Wrong

```rust
lines.find(|line| extract_semver(line).is_some())
```

```tsx
{updateAvailable ? <UpdateBadge /> : <UpToDateBadge />}
```

#### Correct

```rust
lines.find(|line| is_canonical_claude_version_line(line))
```

```tsx
{updateAvailable && latestVersion
  ? <UpdateBadge />
  : latestVersion
    ? <UpToDateBadge />
    : null}
```
