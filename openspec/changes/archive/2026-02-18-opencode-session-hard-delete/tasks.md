# Tasks: UX 交互调整 — OpenCode 删除 & 看板交互修复

## 1. P0 主链路（先实现再联调）

### 1.1 后端实现 `opencode_delete_session` command

- [x] 在 `src-tauri/src/engine/commands.rs` 中新增 `opencode_delete_session` 函数
- [x] 复用 `build_opencode_command` 构建 CLI 命令
- [x] 实现混合删除策略：先尝试 `opencode session delete <id>`，失败则回退文件系统删除
- [x] 文件系统删除需探测 OpenCode 会话存储路径
- [x] 删除成功返回 `{ "deleted": true, "method": "cli"|"filesystem" }`
- [x] 删除失败返回带标准错误码前缀的错误信息（至少覆盖 `WORKSPACE_NOT_CONNECTED` / `SESSION_NOT_FOUND` / `IO_ERROR`）

**输入**: workspace_id, session_id  
**输出**: JSON 删除结果  
**验证**: cargo test + 手动调用验证  
**依赖**: 无  
**优先级**: P0

### 1.2 后端实现文件系统回退删除函数

- [x] 新增 `delete_opencode_session_files` 辅助函数
- [x] 探测候选路径：`$OPENCODE_HOME/sessions/<id>`, `<workspace>/.opencode/sessions/<id>`
- [x] 使用 `std::fs::remove_dir_all` 删除目录
- [x] 文件不存在时返回 SESSION_NOT_FOUND 错误（非 panic）
- [x] 权限不足时返回 IO_ERROR

**输入**: workspace_path, session_id, config  
**输出**: Result<(), String>  
**验证**: 单元测试  
**依赖**: 1.1  
**优先级**: P0

### 1.3 注册 Tauri Command

- [x] 在 `src-tauri/src/lib.rs` 中添加 `engine::opencode_delete_session` 到 command 注册列表
- [x] 在 `src-tauri/src/engine/mod.rs` 中导出 `opencode_delete_session`

**输入**: 无  
**输出**: 编译通过  
**验证**: cargo build  
**依赖**: 1.1  
**优先级**: P0

### 1.4 前端新增 IPC 调用 `deleteOpenCodeSession`

- [x] 在 `src/services/tauri.ts` 中新增 `deleteOpenCodeSession(workspaceId, sessionId)` 函数
- [x] 调用 `invoke("opencode_delete_session", { workspaceId, sessionId })`
- [x] 返回类型与 `archiveThread` 保持一致

**输入**: workspaceId, sessionId  
**输出**: Promise<any>  
**验证**: TypeScript 编译通过  
**依赖**: 1.3  
**优先级**: P0

### 1.5 前端 Hook 集成 OpenCode 删除分支

- [x] 在 `src/features/threads/hooks/useThreadActions.ts` 中找到 OpenCode 分支
- [x] 将 `throw new Error("[ENGINE_UNSUPPORTED]...")` 替换为 `await deleteOpenCodeSession(workspaceId, sessionId)`
- [x] session_id 从 threadId 中提取（去除 `opencode:` 前缀）
- [x] 保持错误向上传播（不吞错）

**输入**: 代码修改  
**输出**: OpenCode 会话删除请求正确发往后端  
**验证**: 手动测试 + TypeScript 编译  
**依赖**: 1.4  
**优先级**: P0

### 1.6 看板 Trigger 选中态实现

- [x] 在 `src/features/composer/components/Composer.tsx:1340` 修改 trigger button 的 className
- [x] 将 `"composer-kanban-trigger"` 改为 `` `composer-kanban-trigger${selectedLinkedPanel ? " is-active" : ""}` ``
- [x] 确认 `selectedLinkedPanel` 变量在作用域内可用（line 830 已定义）
- [x] 在 `src/styles/composer.css` 中 `.composer-kanban-trigger:hover` 规则之后新增：
  ```css
  .composer-kanban-trigger.is-active {
    border-color: var(--border-strong);
    color: var(--text-strong);
  }
  ```
- [x] 确保选中态 + hover 态不冲突（样式一致，无需额外处理）

**输入**: TSX + CSS 修改  
**输出**: 选中看板时 trigger button 显示深色  
**验证**: TypeScript 编译 + 目视确认  
**依赖**: 无  
**优先级**: P0

### 1.7 看板 Popover 关闭策略实现

- [x] 在 `src/features/composer/components/ComposerContextMenuPopover.tsx` 中新增 `closeOnBackdropClick?: boolean`
- [x] 解构时添加 `closeOnBackdropClick = true` 默认值
- [x] 修改 backdrop 的 `onClick`：`onClick={closeOnBackdropClick ? onClose : undefined}`
- [x] 在 `src/features/composer/components/Composer.tsx` 的 kanban popover 使用处添加 `closeOnBackdropClick={false}`

**输入**: TSX 修改  
**输出**: 看板 popover 不再因点击外部区域关闭  
**验证**: TypeScript 编译 + 手动测试  
**依赖**: 无  
**优先级**: P0

### 1.8 P0 主链路冒烟验证

- [x] 创建 OpenCode 会话 → 对话 → 在 sidebar 点击删除 → 确认删除成功
- [x] 验证删除后重启应用，该会话不再出现
- [x] 验证磁盘上对应文件/目录已清除
- [x] 打开 Composer → 点击看板 trigger → 选中一个看板 → trigger button 变深色
- [x] 再次点击同一看板取消选中 → trigger button 恢复灰色
- [x] 切换不同看板 → trigger button 持续深色
- [x] 打开看板 popover → 点击 Composer 输入框区域 → popover 不关闭，输入框获焦
- [x] 打开看板 popover → 按 Escape → popover 正常关闭
- [x] 打开看板 popover → 再次点击触发按钮 → popover 正常关闭（toggle）

**输入**: 手动操作  
**输出**: 三个问题主路径全部可用  
**验证**: 目视确认 + 文件系统检查  
**依赖**: 1.5, 1.6, 1.7  
**优先级**: P0

## 2. P1 回归与健壮性（主链路通过后）

### 2.1 后端单元测试补齐

- [x] 测试 CLI 删除成功路径
- [x] 测试 CLI 失败 + 文件系统回退成功路径
- [x] 测试会话不存在时的错误返回
- [x] 测试无效 session_id 的处理
- [x] 测试 workspace_id 不存在时返回 `WORKSPACE_NOT_CONNECTED`
- [x] 测试成功返回体包含 `method` 字段且值合法

**输入**: 测试用例  
**输出**: 测试全部通过  
**验证**: cargo test  
**依赖**: 1.1, 1.2  
**优先级**: P1

### 2.2 错误码映射验证

- [x] 确认 `mapDeleteErrorCode` 正确处理后端返回的错误信息
- [x] 确认后端错误信息包含可识别关键字（`[WORKSPACE_NOT_CONNECTED]`、`[SESSION_NOT_FOUND]`、`[IO_ERROR]`）
- [x] 如有必要，在后端错误返回中添加错误码前缀

**输入**: 错误场景枚举  
**输出**: 所有错误码正确映射  
**验证**: 手动触发各种错误场景  
**依赖**: 1.5  
**优先级**: P1

### 2.3 多引擎回归验证

- [x] 验证 Claude 会话删除不受影响
- [x] 验证 Codex 会话归档/删除不受影响
- [x] 验证其他 ComposerContextMenuPopover 使用场景（如文件上下文菜单）行为不变
- [x] 深色模式下验证看板 trigger 选中态视觉效果

**输入**: 手动操作  
**输出**: 既有能力无回归  
**验证**: 手动测试  
**依赖**: 1.8  
**优先级**: P1

### 2.4 边界场景验证

- [x] 删除不存在的 OpenCode 会话 → 返回 SESSION_NOT_FOUND
- [x] 使用无效/未连接 workspace_id 删除 OpenCode 会话 → 返回 WORKSPACE_NOT_CONNECTED
- [x] 删除正在活跃的 OpenCode 会话 → 行为符合预期（先 interrupt 或提示）
- [x] 删除 pending 状态的 OpenCode thread → 被 pending 检查拦截，不调用后端

**输入**: 手动操作  
**输出**: 边界行为符合预期  
**验证**: 手动测试  
**依赖**: 1.8  
**优先级**: P1

## 3. P2 规范项（实现与验证后收口）

### 3.1 更新 conversation-hard-delete spec

- [x] 修改 codex-opencode deletion path scenario，明确 OpenCode 使用文件级 hard delete
- [x] 补充 OpenCode 特有的错误场景

**输入**: spec 文件编辑  
**输出**: spec 准确反映实现  
**验证**: 规范审查  
**依赖**: 2.4  
**优先级**: P2

### 3.2 维护 opencode-session-deletion spec

- [x] 确认 OpenCode 会话删除契约与最终实现一致
- [x] 使用 GIVEN/WHEN/THEN 格式
- [x] 覆盖成功、失败、边界场景

**输入**: spec 文件校验/修订  
**输出**: 规范文件  
**验证**: 规范审查  
**依赖**: 2.4  
**优先级**: P2

### 3.3 维护 kanban-trigger-active-state spec

- [x] 确认看板 trigger button 选中态视觉契约与实现一致
- [x] 使用 GIVEN/WHEN/THEN 格式

**输入**: spec 文件校验/修订  
**输出**: 规范文件  
**验证**: 规范审查  
**依赖**: 2.3  
**优先级**: P2

### 3.4 维护 kanban-popover-dismiss-behavior spec

- [x] 确认看板 popover 关闭行为契约与实现一致
- [x] 使用 GIVEN/WHEN/THEN 格式
- [x] 覆盖：backdrop 点击不关闭、Escape 关闭、触发按钮 toggle 关闭

**输入**: spec 文件校验/修订  
**输出**: 规范文件  
**验证**: 规范审查  
**依赖**: 2.3  
**优先级**: P2
