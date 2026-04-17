## 1. Session Navigation Fix

- [x] 1.1 梳理 Spec Hub 打开态下会话点击事件链路与状态源。
- [x] 1.2 实现“点击会话后优先进入会话并退出 Spec Hub 前台态”。
- [x] 1.3 补充回归验证：从 Spec Hub 打开态点击不同会话均可成功切换。

## 2. Sidebar Entry Enhancement

- [x] 2.1 在左侧 rail 底部新增 Spec Hub icon 入口（含 tooltip/可访问性标签）。
- [x] 2.2 保证入口在会话页可见且点击可打开 Spec Hub。
- [x] 2.3 校验新增 icon 不影响 rail 固定与项目区滚动解耦规则。

## 3. Compatibility & Regression

- [x] 3.1 验证欢迎页既有 Spec Hub 入口仍可使用。
- [x] 3.2 验证侧栏与欢迎页两种入口打开行为一致。
- [x] 3.3 记录手测结果与潜在边界场景（快速连续点击、无活动会话）。

## 4. Completion Feedback File List Accuracy

- [x] 4.1 梳理收尾反馈弹窗“变更文件”字段的数据来源与解析链路（最终结果/实时输出）。
- [x] 4.2 修复“存在变更文件却显示(无)”的判定逻辑，统一成功态下的列表提取与渲染。
- [x] 4.3 补充回归验证：当创建成功且有文件变更时显示非空列表；仅在确无文件时显示`(无)`。

## 5. Changes Tree Grouping & Collapse Controls

- [x] 5.1 梳理归档变更目录命名规则，提取日期前缀分组键（`YYYY-MM-DD-*`）。
- [x] 5.2 在“已归档”视图实现树形结构：日期节点可展开/收起，子项沿用现有变更卡片交互。
- [x] 5.3 增加不匹配日期前缀项的兜底分组（“其它”），确保条目不丢失。
- [x] 5.4 补充回归验证：平铺列表迁移为树形后，筛选、选中态与点击进入行为不回退。
- [x] 5.5 将日期分组树形结构扩展到“全部”视图，并对齐与“已归档”一致的展开/折叠体验。
- [x] 5.6 将按钮组前漏斗 icon 替换为“展开全部/折叠全部”控制按钮。
- [x] 5.7 补充批量展开/折叠回归验证：切换筛选标签后状态不串扰、当前视图分组可一键同步切换。

## 6. Visual Icon Accent

- [x] 6.1 为日期分组节点补充语义化 icon（例如日历/目录），增强分组识别。
- [x] 6.2 为状态条目补充轻量 icon 点缀（例如已验证/进行中），保持文本状态为主信息。
- [x] 6.3 验证 icon 点缀不影响可访问性标签、点击热区与列表可读性。

## 7. Preflight Gate Alignment（提案/验证/归档）

- [x] 7.1 抽取并复用统一 delta preflight evaluator，覆盖 operation 解析、target spec 存在性、requirement 标题对齐。
- [x] 7.2 在 create/append proposal 成功后增加 preflight 检查并展示结构化 blocker/hint。
- [x] 7.3 在 verify 触发前增加 preflight 拦截；失败时阻止 strict validate 并给出修复指引。
- [x] 7.4 保持 archive 前 preflight 作为最终硬门禁，不调整既有严格判定标准。
- [x] 7.5 增加 custom spec root 场景回归，确保外部 spec 根目录与内置根目录判定一致。
- [x] 7.6 增加埋点（proposal_post / verify_pre / archive_pre）并验证事件字段完整性。

## 8. Spec Hub i18n Cleanup（模块整理提修复）

- [x] 8.1 梳理 Spec Hub 模块可见文案清单（按钮、分组标题、状态标签、空态、反馈弹窗字段）。
- [x] 8.2 清理 UI 硬编码文案并统一替换为 `specHub.*` i18n key。
- [x] 8.3 补齐 `zh-CN`/`en-US` locale 文案，确保语义对齐且无遗漏。
- [x] 8.4 回归验证语言切换：关键流程文案实时刷新，不展示原始 i18n key。
- [x] 8.5 约束新增文案准入：Spec Hub 后续新增可见文案默认必须走 i18n key。
