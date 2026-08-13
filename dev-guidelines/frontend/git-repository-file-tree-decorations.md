# Multi-Repository File Tree Git Decoration Contract

本规范固化 workspace 内多个 Git repository 的聚合状态、路径投影与 file tree decoration contract。适用于 `src-tauri/src/git_utils.rs`、`src/types/git.ts`、`src/features/git/utils/gitRepositorySummary.ts` 与 `src/features/files/components/FileTreePanel.tsx`。

## 1. Scope / Trigger

- Trigger：修改 `GitRepositorySummary`、repository discovery/status scan、file tree Git 着色或 repository summary token。
- 目标：一次 aggregate refresh 同时更新所有 repository，folder icon 保持原 resolver 样式，Git state 只作用于文字和 summary token。
- 禁止：frontend 按 repository 新增 polling/invoke；payload 携带 diff content、additions/deletions 或 commit history。

## 2. Signatures

```rust
pub(crate) struct GitRepositoryFileStatus {
    pub(crate) path: String,
    pub(crate) status: String,
}

pub(crate) struct GitRepositorySummary {
    // existing fields omitted
    #[serde(default)]
    pub(crate) file_statuses: Vec<GitRepositoryFileStatus>,
}
```

```ts
export type GitRepositoryFileStatus = {
  path: string;
  status: "A" | "M" | "D" | "R" | "T" | "U";
};

export function projectGitRepositoryFileStatuses(
  repositories: GitRepositorySummary[],
): GitRepositoryFileStatus[];
```

## 3. Contracts

- Rust 在现有 aggregate `git_repository_summaries` status iteration 中生成 repository-relative `file_statuses`，不得执行第二次 status scan。
- Desktop 与 remote daemon 复用同一 Rust type/collector；unavailable repository 返回 row-local `error` 与空 `file_statuses`，不得阻断 sibling repositories。
- TypeScript boundary 同时接受 `fileStatuses` / `file_statuses`，缺失字段 normalize 为 `[]`。
- root repository 的 `src/index.ts` 投影仍为 `src/index.ts`；nested repository `services/api` 的同一路径投影为 `services/api/src/index.ts`。
- `FileTreePanel` 必须把 exact repository path 作为 folder-chain collapse boundary，避免 `services/api/src` 被压缩后丢失 repository row identity。
- Folder status priority 固定为 conflict `U` > deleted `D` > added `A` > modified `M` > renamed `R` > type-changed `T`。
- repository row 不得覆盖 `.file-tree-icon` color，也不得添加 repository-specific icon marker；branch/status token 使用现有 semantic theme variables。
- Git decoration MUST 使用集中式 theme tokens，禁止在 `file-tree.css` / `composer.part2.css` 分别硬编码 palette：
  - dark：added `#73D0A9`、modified `#FFAA3E`、deleted `#F07178`、renamed `#82AAFF`、type-changed `#C792EA`、conflict `#FF5370`、branch `#FFB37A`。
  - light/system-light：added `#2E9D69`、modified `#D97706`、deleted `#C2414B`、renamed `#2563EB`、type-changed `#7C3FA3`、conflict `#D32F4B`、branch `#C96B2C`。
- changed file/folder name MUST 使用 `font-weight: 550`；unchanged row 继续使用 `400`，folder/file icon 不得随之加粗或着色。
- exact dirty repository folder MUST 使用独立 `--git-repository-dirty`，dark 为 `#82AAFF`、light/system-light 为 `#2563EB`；不得继承 descendant 的 added/modified/conflict color。内部 ordinary folder/file 仍按 status-specific palette。
- `.file-tree-git-token.is-branch` 与 `.composer-git-repository-token.is-branch` MUST 使用 `--git-branch` + `font-weight: 600`；sync/count token 不得继承该字重。

## 4. Validation & Error Matrix

| 输入 | Boundary 结果 | UI 结果 |
|---|---|---|
| `src/index.ts` + known status | 接受并 normalize separator | file 与 ancestor folder 着色 |
| `src\\index.ts` | normalize 为 `src/index.ts` | 与 POSIX path 等价 |
| 缺失 `fileStatuses` | normalize 为 `[]` | branch/count 继续显示，无 file decoration |
| absolute path / drive prefix | 丢弃 entry | 不得越出 workspace tree |
| empty / `.` / `..` traversal | 丢弃 entry | 不得命中任何 row |
| unknown status | 丢弃 entry | 不得伪装为 clean/dirty |
| repository open/status failure | 保留 summary error，entries 为空 | 仅当前 row error token，siblings 正常 |
| explicit dark theme | dark `--git-status-*` / `--git-branch` | IDEA dark palette + warm-orange branch |
| explicit light / system-light | light `--git-status-*` / `--git-branch` | IDEA light palette + darker warm-orange branch |
| changed name | known Git class | name weight `550`，icon unchanged |
| exact dirty repository + added descendants | `is-git-repository git-a` | repository blue，descendant added green |
| exact dirty repository + modified/conflict descendants | `is-git-repository git-m/git-u` | 同一 repository blue，descendant 保持 orange/red |
| repository branch | branch semantic token | warm-orange + weight `600` |

## 5. Good / Base / Bad Cases

- Good：root、`service-a`、`service-b` 同次 aggregate response 各自携带 changed paths，三个 repository 的 file/folder decoration 同时可见。
- Base：旧 backend 未返回 decoration field，frontend 使用空 collection 并保留既有 summary rendering。
- Bad：component 对每个 repository 单独调用 Git command，或直接拼接未经校验的 `../outside` path。

## 6. Tests Required

- Rust `git_utils::tests`：assert root + two sibling repositories、compact status mapping、partial failure 与 empty error collection。
- `gitRepositorySummary.test.ts`：assert snake/camel compatibility、separator normalization、absolute/traversal rejection、root/nested projection、semantic token kind。
- `FileTreePanel.run.test.tsx`：assert two dirty repositories 的 exact repository folder、descendant file 与 ancestor folder 同时着色，并锁定 collapse boundary。
- `file-tree-git-decorations.test.ts`：assert repository icon override/marker selector 不存在，semantic CSS variables 存在。
- 同一 CSS contract test MUST assert dark/light/system-light 的关键 palette values、file tree/Composer 共同消费 `--git-branch`，以及 changed name 的 `font-weight: 550`。
- CSS contract MUST assert exact repository selector 消费 `--git-repository-dirty`，branch selector 使用 `font-weight: 600`；render test MUST assert different status classes 的 sibling repository rows 都具有 `is-git-repository` identity。
- Gate：`npm run typecheck`、`npm run lint`、focused Vitest、focused Rust tests、runtime contracts 与 strict OpenSpec validation。

## 7. Wrong vs Correct

### Wrong

```ts
repositories.forEach((repository) => refreshGitStatus(repository.root));
const workspacePath = `${repository.root}/${unsafeBackendPath}`;
```

### Correct

```ts
const summaries = await listGitRepositorySummaries(workspaceRoot);
const workspaceStatuses = projectGitRepositoryFileStatuses(summaries);
```

一次 aggregate refresh 保留 bounded discovery/stale-result guard；projection helper 只消费 boundary 已校验的 repository-relative paths。
