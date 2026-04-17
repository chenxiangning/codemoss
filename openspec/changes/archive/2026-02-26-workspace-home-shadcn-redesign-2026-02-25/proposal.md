## Why

当前 Workspace Home 首页在信息层级、视觉节奏和交互可读性上不满足生产级 UX
要求：核心入口（新建会话、继续会话、规范入口、最近会话管理）虽然可用，但扫描成本高、状态表达弱、主题切换一致性不足。现在需要以
shadcn/ui 组件范式重构首页，使其在不改变既有业务语义的前提下达到可持续演进的生产质量。

## 目标与边界

- 目标：将 Workspace Home 重构为基于 shadcn/ui 的卡片化首页信息架构，提升可读性、操作效率与视觉一致性。
- 目标：保证浅色/深色主题下视觉层级、状态色、对比度与交互反馈一致。
- 目标：保留并强化现有关键能力语义（引擎选择、新建会话、继续会话、OpenSpec/Spec-kit 入口、最近会话批量管理）。
- 边界：本次仅覆盖 Workspace Home 首页，不改 Spec Hub 三栏工作台。
- 边界：不新增后端接口，不变更线程删除协议，不改会话启动参数契约。

## 非目标

- 不改动 OpenSpec/Speckit 的 provider 路由逻辑。
- 不引入新的业务流程（如新的引导动作类型或批量恢复能力）。
- 不重写全局 Design Token，仅在首页消费既有主题 token。

## What Changes

- 重构 Workspace Home 为三段式布局：
    - Hero 区：工作树身份、分支、路径、引擎选择与主操作（新建/继续）。
    - Guide 区：OpenSpec 与 Spec-kit 入口卡片 + 通用执行引导列表。
    - Recent 区：最近会话列表与批量管理工具条。
- 统一 shadcn/ui 组件语义：Button/Card/Badge/Select 在首页实现中作为主构件，减少自定义样式噪声。
- 新增主题一致性约束：浅色/深色模式下同一状态（idle/processing/reviewing、danger/normal）必须保持语义等价。
- 明确删除管理可见性：管理态、选中态、二次确认态必须在两种主题下都有可辨识对比。
- 补充首页视觉与交互验收标准，避免后续回归为“可用但难用”的实现。

## 技术方案对比与取舍

| 方案                    | 描述                              | 优点              | 风险                       |
|-----------------------|---------------------------------|-----------------|--------------------------|
| A. 仅调 CSS 细节          | 维持现有结构，只微调 spacing/color/border | 成本低，改动快         | 信息架构问题不解决，长期可维护性差        |
| B. 全量自研新组件            | 自建一套首页专用组件体系                    | 自由度高            | 与现有 shadcn/ui 风格割裂，维护成本高 |
| C. shadcn/ui 范式重组（采用） | 复用现有 ui primitives，重排结构并重写首页样式层 | 一致性高、风险可控、可测试性好 | 需要处理旧 class 与新结构兼容       |

取舍结论：采用 C。优先复用现有 shadcn/ui primitives，避免重复造轮子；通过结构重排解决 UX 根因，而非只做表层美化。

## 验收标准

1. 首页在浅色与深色模式下均 SHALL 保持三段式信息架构清晰可辨，且核心 CTA 可在首屏定位。
2. 引擎选择与“新建会话/继续最近会话” SHALL 保持既有行为语义，不得改变调用参数与禁用逻辑。
3. OpenSpec 与 Spec-kit 入口 SHALL 保持可达，并以等权卡片呈现，不得出现仅靠颜色区分的低可读状态。
4. 最近会话批量管理 SHALL 保留二次确认删除机制，且在管理态/确认态/删除中态有明确视觉差异。
5. 首页重构后 SHALL 继续满足 `workspace-home-opencode-entry` 与 `workspace-recent-conversations-bulk-management` 既有要求。
6. 首页相关单元测试 SHALL 通过，且不引入行为回归（会话启动、继续、选择、删除链路）。

## Capabilities

### New Capabilities

- `workspace-home-shadcn-ux`: 定义 Workspace Home 的生产级视觉信息架构、主题一致性和交互可读性基线。

### Modified Capabilities

- `workspace-home-opencode-entry`: 在新首页结构下补充“入口可发现性与语义保真”要求。
- `workspace-recent-conversations-bulk-management`: 在新视觉结构下补充“管理态与风险态可辨识”要求。

## Impact

- Frontend UI:
    - `src/features/workspaces/components/WorkspaceHome.tsx`
    - `src/features/workspaces/components/WorkspaceHomeSpecModule.tsx`
    - `src/styles/workspace-home.css`
- Frontend tests:
    - `src/features/workspaces/components/WorkspaceHome.test.tsx`
- Specs:
    - `openspec/specs/workspace-home-shadcn-ux/spec.md`（新增）
    - `openspec/specs/workspace-home-opencode-entry/spec.md`（修改）
    - `openspec/specs/workspace-recent-conversations-bulk-management/spec.md`（修改）
