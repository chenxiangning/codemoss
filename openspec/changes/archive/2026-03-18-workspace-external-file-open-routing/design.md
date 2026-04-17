## Context

当前实现中，`session activity -> File change` 的跳转最终进入统一文件读取链路。  
该链路默认把目标路径当作 workspace 相对文件读取，因此当路径为外部 OpenSpec 绝对路径时，会被 workspace 边界校验拒绝。  
该问题在存在自定义 external OpenSpec root 的团队工作流中高频出现，且用户已在界面明确看到有效路径，失败体验强烈。

## Goals / Non-Goals

**Goals:**
- 在不破坏现有 workspace 文件打开行为的前提下，新增外部 OpenSpec 路径处理分支。
- 让 `session activity` 的 `File change` 可以打开 active external spec root 下的文件。
- 对 Win/Mac 路径格式差异提供一致匹配策略。
- 对无法归属的外部路径提供可恢复提示，避免崩溃或无反馈失败。

**Non-Goals:**
- 不引入“任意系统路径可读”能力。
- 不改变 `live edit preview`、`SOLO` 自动抢焦点策略。
- 不重构现有 `onOpenDiffPath` 或 editor tab 管理模型。

## Decisions

1. 增量分流而非替换现有读取链路  
保留现有 workspace 文件读取逻辑作为第一优先级；仅在“路径不属于 workspace 且命中 active external spec root”时走 external spec 读取 API。  
Alternative considered: 统一改成多根读写抽象。  
Why not: 范围过大、回归风险高，不符合本次缺陷修复目标。

2. 引入“目标域判定”模型（workspace / external-spec / unsupported-external）  
在前端先做路径归一化和域判定，再选择读取 API：  
- `workspace` -> `readWorkspaceFile`（现状）  
- `external-spec` -> `readExternalSpecFile`（新增使用场景）  
- `unsupported-external` -> recoverable hint  
Alternative considered: 后端统一透传绝对路径自动判定。  
Why not: 安全边界与现有 API 契约会被稀释，且难以保持无回归。

3. 跨平台路径匹配基线  
- 统一分隔符为 `/`  
- Windows 盘符路径按大小写不敏感比较  
- 保留现有 workspace path normalize 规则，不改已有行为  
Alternative considered: 全平台都大小写不敏感。  
Why not: 与 macOS/Linux 真实语义不一致。

4. 保持安全边界显式可见  
当路径不在 workspace 且不在 active external spec root 下时，不做降权兜底读取；直接提示用户该路径不在可读根范围。  
Alternative considered: 回退到 `openPath` 打开系统文件。  
Why not: 与编辑器内读取契约不一致，且会制造“可见但不可编辑”的语义混乱。

## Risks / Trade-offs

- [Risk] 路径归一化误判（尤其 Windows UNC、盘符大小写） → Mitigation: 增加路径比较单测覆盖 drive-letter、backslash、case-insensitive 场景。
- [Risk] 分流逻辑与现有 file tab 状态耦合导致回归 → Mitigation: 仅在读入口增加分支，不改 tab 状态机与焦点策略。
- [Risk] 用户期望打开任意外部路径 → Mitigation: 明确提示“仅支持 workspace + active external spec root”。

## Migration Plan

1. 在路径解析层新增目标域判定函数，并补齐单测。  
2. 在 `session activity` 文件打开入口接入分流决策。  
3. 在文件读取服务层接入 external spec 读取分支（只读）。  
4. 回归验证 workspace 内绝对/相对路径行为无变化。  
5. 验证 external spec root 在 Mac/Win 下均可打开。  

Rollback strategy:
- 通过 feature patch 回退到原 workspace-only 分支（移除新增判定与 external route 调用）；不会影响数据模型与存储。

## Open Questions

- `unsupported-external` 提示是否需要提供“一键在系统文件管理器中打开”作为辅助动作？
- 对 symbolic link 指向 external spec root 内文件的路径，是否在本变更中纳入支持，还是后续单独处理？
