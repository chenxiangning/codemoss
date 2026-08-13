## MODIFIED Requirements

### Requirement: Workspace Sidebar Hydration MUST Be Staged And Deduplicated

系统 MUST 按 foreground priority 分阶段加载 workspace sidebar sessions，并确保同一 workspace/query generation 不会并发启动重复 hydration。

Session Index 快速路径的 first-paint 完成态 MUST 是「Index list-level 行 + verified Shared Native visibility projection」。该 projection 是与 Index snapshot 同次返回或可验证复用的同一 ownership fact，而不是以空 hide set 进行乐观投影。若该事实暂时不可用，系统 MUST 保留上一份已验证结果或显示受影响 native rows 的 pending state，直到可安全投影。

Visibility 读取 MUST 使用独立只读路径，MUST NOT 通过 `SharedEventWriter` actor 命令通道等待 recovery / projection。

#### Scenario: active workspace hydrates before idle workspaces

- **WHEN** AppShell 对多个 workspace 发起 sidebar hydration
- **THEN** 当前 active workspace 的 session 请求优先执行
- **AND** idle workspace 的 hydration 在 scheduler 允许时延后执行
- **AND** idle workspace 失败不得阻塞 active workspace 的已缓存 session 展示

#### Scenario: duplicate hydration request reuses current work

- **WHEN** 同一 workspace 在同一 query generation 内再次请求 hydration
- **THEN** 系统 MUST 复用进行中的请求或其结果
- **AND** 不得启动重复的 provider/session loading pipeline
- **AND** query generation 变化后旧请求结果不得覆盖新请求结果

#### Scenario: first Session Index projection carries Shared visibility facts

- **WHEN** active workspace 使用 Session Index 作为 cold-start 或 soft-refresh 的 sidebar 数据源
- **THEN** Session Index response MUST include or reference a Shared Native visibility projection
- **AND** the mapper MUST apply a usable projection or the last verified hide set before the first ordinary native `setThreads` write
- **AND** that first write MUST preserve existing or last-good `shared:*` canonical rows
- **AND** later Shared Session reconciliation MUST merge with, rather than replace, the verified visibility facts

#### Scenario: missing visibility facts fail closed for new ordinary native rows

- **WHEN** the Session Index request succeeds but its Shared visibility projection is unavailable and no last verified hide set exists
- **THEN** the hydration pipeline MUST NOT render the newly received ordinary native rows with an empty hide set
- **AND** it MUST keep the last verified sidebar snapshot when one exists, otherwise leave affected native rows pending
- **AND** it MUST NOT remember the unfiltered Index rows as last-good
- **AND** it MUST expose enough loading or diagnostic state to distinguish this partial condition from an empty workspace

#### Scenario: stale request abandon does not leave an unfiltered Index snapshot

- **WHEN** Session Index rows arrive but the list request is abandoned before a verified hide set can be applied
- **THEN** the client MUST NOT commit those rows with an empty hide set
- **AND** the previous verified sidebar snapshot MUST remain in place

#### Scenario: visibility protection preserves bounded first-paint behavior

- **WHEN** the pipeline waits for a verified Shared visibility projection
- **THEN** it MUST NOT fall back to exhaustive native catalog enumeration, transcript loading, or an unbounded history scan on the foreground path
- **AND** it MUST NOT block first-paint on the Shared EventWriter actor
- **AND** normal native rows with no Shared ownership evidence MUST remain eligible for the bounded Session Index path when the projection is available
