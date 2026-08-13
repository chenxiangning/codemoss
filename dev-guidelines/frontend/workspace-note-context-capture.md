# Workspace Note Context Capture Contract

## Scenario: Source-aware capture into the existing note workbench

### 1. Scope / Trigger

- Trigger：修改 code/conversation 右键采集、`WorkspaceNoteCaptureRequest`、note workbench 创建态/最大化、`note_card_create` payload 或 note JSON source。
- 目标：三类上下文只生成 draft，由现有 workbench 确认保存；不得在 surface 内复制 CRUD 或直接落盘。workbench maximize 只接管中央 conversation/note split，不得遮住 right panel 或 native window。

### 2. Signatures

```ts
type NoteCaptureDraft = {
  title: string;
  bodyMarkdown: string;
  source: WorkspaceNoteCardSource;
};

type WorkspaceNoteCaptureRequest = {
  requestId: number;
  draft: NoteCaptureDraft;
};

type WorkspaceNoteCardsLayoutControls = {
  canMaximize: boolean;
  isMaximized: boolean;
  onToggleMaximized: () => void;
};

type EditorSplitCompanion = "chat" | "notes" | "projectMap";

type EditorNavigationLocation = {
  line: number;
  endLine?: number;
  column: number;
  scrollPosition?: "nearest" | "center";
};

noteCardCreate(input: {
  workspaceId: string;
  bodyMarkdown: string;
  source?: WorkspaceNoteCardSource | null;
}): Promise<WorkspaceNoteCard>;
```

Rust boundary：

```rust
fn normalize_note_source(
    source: Option<WorkspaceNoteCardSource>,
) -> Result<Option<WorkspaceNoteCardSource>, String>;
```

Source kinds 与 payload fields：

- `codeSelection`: `path`, `startLine`, `endLine`, optional `language`
- `conversationSelection`: `threadId`, `itemIds`
- `conversationThread`: `threadId`, `itemCount`, `capturedAt`

### 3. Contracts

- `FileViewBody` MUST 从 CodeMirror canonical selection 或 preview logical line selection 生成 fenced Markdown；不得解析 syntax DOM。
- `FileViewBody` MUST 只冻结 canonical selection draft，并通过 `onFileContextMenu(event, noteCaptureDraft)` 交给 `FileViewPanel`；不得再维护或 render 独立 note-only `RendererContextMenu`。
- `FileViewPanel` MUST own file content menu composition。存在 selection draft 时优先 capture selection；无 selection 且 source 未 truncated/blank 时，edit mode MUST 从当前 CodeMirror document、preview mode MUST 从完整 loaded source 构造 line 1 到 final line 的 whole-file draft。
- conversation local selection MUST 在 menu 打开时冻结 text/item ids；Copy 与 note capture MUST 使用同一 snapshot。
- whole conversation MUST 从 canonical `ConversationItem[]` 生成，只保留 visible user text、final assistant、completed/legacy-final diff 与 completed review；排除 reasoning/tool/explore/live assistant。
- layout owner MUST 用 monotonic request 路由到 notes center；request 不得进入 streaming/root conversation store。
- `WorkspaceNoteCardPanel` MUST 先进入 creating 并等待用户确认；context-menu handler MUST NOT 调用 `noteCardCreate`。
- Rust `source` MUST 是 optional additive JSON field；普通 update 不发送 source，并保留原 attribution。
- code capture MUST 仅以 `content.trim()` 判断空白，但 fenced body MUST 使用未 trim 的 canonical selection；leading indentation 与 trailing newline 不得丢失。
- 已保存 `codeSelection` source MUST 通过 note panel typed callback 交给 layout owner；layout owner MUST 将 start/end line 放进同一个 `onOpenFile` navigation target。不得在 file open 前调用 `onActiveEditorLineRangeChange` 预写 range。
- `EditorNavigationLocation.endLine` MUST 保持 optional/additive；未提供时继续使用既有 single-cursor navigation。提供时必须等目标文件加载且 CodeMirror view 可用后，在同一 transaction 设置 selection 与 centered scroll，再由既有 editor selection update path 发布 active line range。
- saved code source navigation MUST 显式传 `editorSplitCompanion: "notes"`；普通 file tree/search/message/Git caller 不传该 option，并继续使用 default `"chat"` 或其既有 `"projectMap"`。
- `WorkspaceNoteCardPanel` MUST 在 `centerMode === "notes"` 与 `centerMode === "editor" && editorSplitCompanion === "notes"` 之间保持 mounted；不得复制一个只读 note sidebar。
- notes Editor companion MUST 强制使用 horizontal split 表现为左 note/right editor，但 MUST NOT 改写持久化的 `editorSplitLayout` preference。
- 关闭最后 tab、关闭全部 tabs 或退出 Editor MUST 返回当前 companion center；notes companion 返回 notes 后 MUST reset 为 chat，workspace switch MUST fail closed 到 chat，避免跨 workspace 泄漏。
- creating/editing 中的 source summary MUST 保持只读，避免导航离开 workbench 时绕过 dirty-draft guard。
- note read-only detail MUST 给 `Markdown` 传入 `codeBlockStyle="message"` 与 `workspaceId`，复用现有 syntax highlighting、language badge、line numbers 与 copy action，不得引入第二套 highlighter。
- 新 code capture body MUST 只保存 safe fenced code；path、line range 与 language 由 structured source 呈现。旧 note body MUST NOT load-time rewrite。
- `DesktopLayout` MUST 持有 transient `isNoteCardsMaximized`，并通过 `WorkspaceNoteCardsLayoutProvider` 将 controlled toggle 暴露给 panel header；不得让 panel 查询 parent/sibling DOM 或写 `document.body` class。
- maximize MUST 只切换 `.content.is-note-cards-maximized` 与 companion interaction state，不得写 `noteCardsSplitRatio` client storage；restore MUST 继续使用原 CSS variable/ref。
- maximized conversation companion MUST 保持 mounted，但 MUST 同时使用 hidden class、`aria-hidden="true"` 与 `inert`；split divider MUST 不渲染。
- right panel 与 main topbar MUST 保持挂载和可交互；离开 `centerMode === "notes"` MUST reset transient maximize state。
- layout context 缺失时 panel MUST 不渲染 maximize action，保证 isolated host/focused test 的 backward compatibility。
- layout context 的 `canMaximize` 只有 notes center 为 true；notes Editor companion 继续保留 provider/component identity，但 MUST 隐藏 maximize action。

### 4. Validation & Error Matrix

| 输入/状态 | 必须行为 | 错误/降级 |
|---|---|---|
| code path 非空且 `1 <= startLine <= endLine` | normalize 后保存 | path 空或 range 非法返回 explicit `Err` |
| file content context menu | selection draft 优先；无 selection 保存完整 canonical source；只 render 一个 shared menu | truncated/blank/non-text 不得伪装成完整文件；不得叠加 note-only popover |
| conversation selection | trim thread id；item ids 去空、去重、最多 128 | thread id/item ids 为空返回 explicit `Err` |
| conversation thread | thread id 非空；count/time 为正 | metadata 非法返回 explicit `Err` |
| `source` 缺失 | 按 legacy note 正常创建/读取 | 不要求 migration |
| dirty workbench 收到 capture | 弹 discard decision；无论接受/拒绝都 consume request | 拒绝时保留原 draft，remount 不重放 |
| active assistant `isFinal === false` | 不进入 semantic body | 已 final 历史正文仍保存 |
| interactive/file-link context menu | 保留原 owner | conversation capture 不接管 |
| saved code source click | `onOpenFile(path, { line: startLine, endLine, ... }, { editorSplitCompanion: "notes" })`；目标文件加载后恢复 range | 不提前写 active range；不在 note feature 读取文件或复制 editor error handling |
| source range 超过当前文档 | start line 有效时 clamp end line 到文档末行 | start line 已不存在时不伪造 selection |
| notes source Editor companion | note 左、Editor 右、right panel 保留；note state 不重建 | 不显示 conversation/Composer 或 companion maximize |
| 普通 file-open | default chat/project-map companion | 不得仅因 note 曾打开而继承 notes companion |
| notes companion 关闭最后 tab/退出 Editor | 返回 notes，并将 companion reset 为 chat | 不返回 conversation，不保留 stale source layout |
| source Editor 中切 workspace | notes companion 清理为 chat | 不把旧 workspace 的 note context 投射到新 workspace |
| creating/editing code source | summary 可读但不可跳转 | 不允许绕过 dirty guard 切走导致草稿丢失 |
| fenced code preview | existing Markdown message renderer | 不新增 dependency/highlighter；不重写 legacy body |
| notes maximize | note layer 占满中央 split；conversation mounted but hidden/inert；divider 不渲染 | right panel/main topbar 不受影响 |
| notes restore | 恢复原 `--note-cards-split-ratio` 与 conversation interaction | 不写 client storage，不重置 note draft/selection |
| maximize 后离开 notes | 自动 reset transient state | 再次进入 notes 不得保持 surprise maximize |
| provider 缺失 | panel 保持正常但不显示 maximize action | 不使用 noop button 暗示不可执行能力 |

### 5. Good / Base / Bad Cases

- Good：surface 生成 `NoteCaptureDraft`，layout 切换 notes，workbench 预填，save 统一走 facade/service/Rust。
- Base：手工新建便签不带 source，现有图片、搜索、归档、恢复、删除与 Composer reference 行为不变。
- Bad：右键 action 直接调用 `noteCardCreate`；会绕过确认、dirty guard 与 retry draft。
- Bad：whole thread 复用 full transcript 后用 regex 删除 tool/reasoning；结构边界已经丢失。
- Good：`DesktopLayout` owns maximize state，panel 只消费 feature-local context；conversation 隐藏但不卸载，right panel 保持可用。
- Good：saved source action 只给现有 `onOpenFile` 增加 `"notes"` companion option，layout 复用同一 note node 与 Editor split divider。
- Base：文件树、搜索、message file link、Git 与 Project Map evidence navigation 保持原 companion semantics。
- Bad：把所有 `handleOpenFile` 默认 companion 改成 notes；会破坏普通 conversation workflow。
- Bad：Editor 中复制第二份 note detail；会丢失 workbench state 并产生双轨交互。
- Bad：只用 CSS 覆盖对话但保留其 focusability，或在 panel 内查询 `.content-layer--chat` 直接改 DOM。

### 6. Tests Required

- `src/features/note-cards/utils/noteCapture.test.ts`：safe fence、single/multi-line、invalid range。
- `src/features/note-cards/utils/noteCapture.test.ts`：leading indentation 与 trailing newline 原文保真、whitespace-only rejection。
- `src/utils/threadText.test.ts`：final dialogue/diff/review inclusion；reasoning/tool/live/pending diff exclusion。
- `src/features/messages/utils/conversationSelection.test.ts`：single/multi-row、outside/collapsed。
- `Messages.note-capture.test.tsx`：Copy + frozen selection、whole semantic action、interactive ownership。
- `FileViewPanel.capture-note.test.tsx` + `FileViewPanel.test.tsx`：edit/preview capture 与 annotation regression。
- `FileViewPanel.capture-note.test.tsx` MUST 覆盖 edit selection、unsaved whole document、preview logical selection、whole-source fallback、blank/truncated rejection 与 single-menu ownership。
- `WorkspaceNoteCardPanel.test.tsx`：default-no-form、view-first、capture consume/reject、save failure retry。
- `WorkspaceNoteCardPanel.test.tsx`：code source read-only navigation callback、conversation source non-navigation、Markdown `codeBlockStyle/workspaceId` contract。
- `useLayoutNodes.client-ui-visibility.test.tsx`：code source path/location/range routing。
- `FileCodeMirrorEditorImpl.test.ts`：single-cursor compatibility、range selection 与 shortened-document end-line clamp。
- `WorkspaceNoteCardPanel.test.tsx`：maximize/restore accessible action 与 creating draft preservation。
- `DesktopLayout.test.tsx`：full central class、conversation mounted + hidden/`aria-hidden`/`inert`、divider removal、right panel persistence、ratio no-write、leave-notes reset。
- `useGitPanelController.test.tsx`：notes companion open/last-tab return、ordinary open reset、workspace-switch isolation。
- `useLayoutNodes.client-ui-visibility.test.tsx`：source route 第三个 option 为 notes，且 note node 只在 notes center/companion mount。
- `DesktopLayout.test.tsx`：notes-left/editor-right、forced horizontal presentation、note local state preservation、conversation inert、right panel persistence、companion maximize hidden。
- `src/services/tauri/noteCards.test.ts`：camelCase payload mapping。
- Rust `note_cards::tests`：legacy JSON、invalid source、normalization、archive/restore source preservation。
- Gates：`pnpm lint`、`pnpm typecheck`、`pnpm check:runtime-contracts`、`cargo check --lib`。

### 7. Wrong vs Correct

#### Wrong

```ts
onSelect: () => noteCardCreate({ workspaceId, bodyMarkdown: selectedText });
```

#### Correct

```ts
onSelect: () =>
  onCaptureNote({
    title,
    bodyMarkdown: selectedText,
    source: { kind: "conversationSelection", threadId, itemIds },
  });
```

#### Wrong

```ts
document.querySelector(".content-layer--chat")?.setAttribute("inert", "");
document.body.classList.add("note-cards-maximized");
```

#### Correct

```tsx
<WorkspaceNoteCardsLayoutProvider
  value={{ canMaximize, isMaximized, onToggleMaximized }}
>
  {noteCardsPanelNode}
</WorkspaceNoteCardsLayoutProvider>
```

#### Wrong

```ts
onOpenFile(source.path, location);
// default companion becomes chat and the note workbench unmounts
```

#### Correct

```ts
onOpenFile(source.path, location, {
  editorSplitCompanion: "notes",
});
```
