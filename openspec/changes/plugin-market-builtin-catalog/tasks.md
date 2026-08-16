# Tasks

- [x] 1.1 内置插件目录数据：45 个种子补 `description` 字段
- [x] 1.2 市场页按 engine / feature 分类展示 + 分类计数
- [x] 1.3 卡片展示描述 / pluginId / ownerClass 徽章 / 安装状态 / 版本 / 权限
- [x] 1.4 安装 / 卸载按钮走 `stageLocalPlugin / unstageLocalPlugin`，状态即时刷新
- [x] 1.5 卸载后可重新安装（同卡片按钮状态闭环）
- [x] 1.6 i18n：zh/en 术语统一（插件市场 / 内置插件 / 安装 / 卸载）
- [x] 1.7 i18n：补齐 fr/es/ja/ko/pt-BR/ru/hi/zh-TW 的 `extensions.rack` 段
- [x] 1.8 样式：卡片 head / 描述 / 徽章 / 计数
- [x] 1.9 测试：PluginRackSection 分组 + 安装/卸载闭环 + 错误态
- [x] 1.10 后端：Host::set_enabled + plugin_rack 总闸/激活/停用命令 + 注册
- [x] 1.11 后端：插排默认关（HostConfig::default）+ 激活无 entry 插件返回明确错误
- [x] 1.12 前端：插排总闸开关 + 未通电时按钮禁用 + gate 提示
- [x] 1.13 前端：安装/卸载走真实后端命令 + loading + 成功/失败提示
- [x] 1.14 前端：卡片压缩多列布局 + 状态徽章
- [x] 1.15 i18n：10 语言通电/激活/错误文案
- [x] 1.16 测试：前端交互闭环 + 后端命令测试
- [x] 1.17 `openspec validate plugin-market-builtin-catalog --strict --no-interactive`
