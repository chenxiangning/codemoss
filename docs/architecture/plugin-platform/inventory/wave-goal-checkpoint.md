# Staged Program Checkpoint（连续推进）

> 日期：2026-08-16  
> 分支：`feature/plugin-mossx-0.8.9`  
> 结论：**合同平面已按当前边界收口。插座本体开 1F1。** 产品路径零变化。不要把本 checkpoint 当成可以删 Core 的绿灯。

## 已落地（按 Wave）

| Wave | 状态 | 最后提交锚点 |
|---|---|---|
| 0 inventory + parser | 完成 | `c71258117` |
| 1A–1D 内存插排 | 完成 | `a3f7cab1b` |
| 1D2 fuse 后 Broker 拒绝 | 完成 | `00c750cbe` |
| 1B2 Host disable 原语 | 完成 | `de6533cc4` |
| 1E–1E6 transport / Data Plane / UDS MXPD | 完成 | `1ce36abdc` |
| 2A–2C Storage + caller 闸门 | 完成 | `a2ea46e80` |
| 3A–3F Claude 插头前半 + fixture disable | 完成（未删实现） | `ba496f762` |
| 4A–4F Notes 门面 + fixture disable | 完成（未迁表） | `7c746feea` |
| 1G–1I 组合面 / 默认 off / 双插头隔离 | 完成 | `e87156c7d` |
| 2D disable 撤销 store | 完成 | `672025d0e` |
| 3G Claude 组合面 disable | 完成（未删实现） | `094ff98fb` |
| 4G Notes 组合面 disable | 完成（未迁表） | `bf6a85972` |
| 1J 组合面 fuse | 完成 | `54b748d3a` |
| 1K command 面隔离 | 完成 | `a56aad1c3` |
| 1L fuse 后 reset 恢复 | 完成 | `06ade989d` |
| 1M 旧 generation 失效 | 完成 | `fab30c466` |
| 2E–2G storage Ready 闸门 | 完成 | `098c48763` |
| 2H–2K migrate 组合面闸门 | 完成 | `cc1afd8cb` |
| 2L 组合面跨插件 store 隔离 | 完成 | `ab6a81b2e` |
| 2M 组合面无 checkpoint 不得 restore | 完成 | `6c35ab547` |
| 1N 组合面拒绝非法 Host 预算 | 完成 | `402c6bd41` |
| 2N 组合面 retainPrevious 1–5 | 完成 | `632974f45` |
| 1O 组合面空 required_entries 失败 | 完成 | `18e28d75e` |
| 2O migrate from 必须匹配 | 完成 | `b1c195b30` |
| 2P disable 后不得 access_store | 完成 | `0e35361ef` |
| 2Q fuse 后不得 access_store | 完成 | `28bddf2ed` |
| 2R fuse 后 reset 恢复 access_store | 完成 | `154526f6f` |
| 2S fuse 后不得 checkpoint | 完成 | `e86b72f1a` |
| 2T fuse 后不得 migrate | 完成 | `2bd315d09` |
| 2U fuse 后不得 restore | 完成 | `ffceaf838` |
| 2V 从未 activate 不得用 store API | 完成 | `386ca9c69` |
| 2W Host 默认 off 不得用 store API | 完成 | `52c7e9364` |
| 1P Host 默认 off 不得 query / stream | 完成 | `d4b5dc8c7` |
| 1Q 从未 activate 不得 query / stream | 完成 | `e9abb304f` |
| 1R 组合面拒绝 write / spawn | 完成 | `275ab6173` |
| 1S 组合面拒绝未知 capability | 完成 | `04b9de9b0` |
| 1T 激活失败后不得拿 handle | 完成 | `8e627c6c4` |
| 1U entry crash 后不得拿 handle | 完成 | `ed2923a93` |
| 1V Failed 后 reset 恢复 handle | 完成 | `5d6c2ea68` |
| 1W Failed 必须先 reset 才能再激活 | 完成 | `000dfb7df` |
| 1X 组合面并发激活满员失败 | 完成 | `38d476f6f` |
| 1Y Ready 再激活换 generation 并撤销旧 handle | 完成 | `2519955b6` |
| 1Z reset 撤销旧 stream | 完成 | `f531b7272` |
| 2X Disabled 必须先 reset 才能再激活 | 完成 | `4ffd47a3d` |
| 2Y Disabled 后 reset 恢复 handle | 完成 | `5e91cf2bf` |
| 2Z disable 后不得 checkpoint / migrate / restore | 完成 | `479af1e91` |
| 1AA 每 generation 最多 8 条 stream | 完成 | `3f64eaa55` |
| 1AB 组合面拒绝未知 codec | 完成 | `f2ae1be71` |
| 1AC 组合面拒绝重复 stream_id | 完成 | `e3dc13a8c` |
| 1AD 组合面拒绝其余 V1 brokered capability | 完成 | `110fac4de` |
| 1AE 组合面拒绝 provider / slot / 私有 capability | 完成 | `44bd9142c` |
| 1AF Claude 不得占用 Notes stream_id | 完成 | `c287f2365` |
| 1AG activation deadline 不得低于 1000ms | 完成 | `9790e6c45` |
| 1AH max_concurrent 不得为 0 | 完成 | `fab01c43d` |
| 1AI crash 后 reset 恢复 handle | 完成 | `c83934c52` |
| 1AJ crash Failed 必须先 reset 才能再激活 | 完成 | `ee2267d06` |
| 2AA Failed 后不得 checkpoint / migrate / restore | 完成 | `3cd1efdc7` |
| 2AB Failed 后不得 access_store | 完成 | `dc8a14d22` |
| 2AC Failed 后 reset 恢复 store API | 完成 | `c12578262` |
| 2AD disable 后 reset 恢复 store lifecycle | 完成 | `73bdd2c16` |
| 2AE fuse 后 reset 恢复 checkpoint | 完成 | `bdb49192d` |
| 1AK fuse Claude 不得撤 Notes stream | 完成 | `17f7e6422` |
| 1AL Activating 态组合面 fail-closed | 完成 | `182e1b156` |
| 1AM Activating 不得 fuse / disable | 完成 | `dc637f945` |
| 1AN 合法 Host 预算边界可构造 | 完成 | `523631484` |
| 1AO 空 pluginId / unitId 不得激活 | 完成 | `8ee215775` |
| 1AP activation deadline 上限 30000ms 合法 | 完成 | `33a8fd284` |
| 1AQ 空白身份 / required entry 不得激活 | 完成 | `e6b2d5882` |
| 1AR generation 0 永远不是 live handle | 完成 | `c3a61e53f` |
| 1AS 未知 / 空白 pluginId 不得 fuse / disable / reset | 完成 | `baa6de892` |
| 1AT retainPrevious=5 合法上限 | 完成 | `4eb42f8d2` |
| 1AU 重复 required entry 不得激活 | 完成 | `0eb1af3f4` |
| 1AV 空白 pluginId 不得摸 store | 完成 | `20367a403` |
| 1AW 空白 pluginId 不得 query / open_stream | 完成 | `546a77718` |
| 1AX log-v1 是合法 V1 codec | 完成 | `5e447734e` |
| 1AY fuse / disable 不得跨终端态互跳 | 完成 | `79d410d2d` |
| 1AZ 空白 codec 不得开流 | 完成 | `33c5fa09f` |
| 1BA 空白 capability 不得 query | 完成 | `092ad5655` |
| 1BB mossx.notifications.publish 必须拒绝 | 完成 | `8ab142f9a` |
| 1BC 空白 target 不得 access_store | 完成 | `296d4a3db` |
| 1BD disable Claude 不得撤 Notes store | 完成 | `3ad51f0bd` |
| 1BE 未 trim 身份不得过闸 | 完成 | `fbb87bd66` |
| 1BF mossx.search.provider 必须拒绝 | 完成 | `a8166e474` |
| 1BG 底层 open_or_create 拒绝未 trim pluginId | 完成 | `27bd58bf0` |
| 1BH 未 trim codec 不得开流 | 完成 | `3f3b0e38c` |
| 1BI 路径不安全 pluginId 不得开 namespace | 完成 | `443817751` |
| 1BJ fuse Claude 不得撤 Notes store | 完成 | `44c0ac1b7` |
| 1BK Host 拒绝非 reverse-DNS pluginId | 完成 | `9c9ce77f2` |
| 1BL 剩余 V1 catalog 一律拒绝 | 完成 | `edafc446c` |
| 1F1 Restricted Process 可逆 spawn | 完成 | `9dd576efd` |
| 1F2 Restricted Process framed stdio handshake | 完成 | `6d283fa4b` |
| 1NP1 Windows Named Pipe 名字闸门 | 完成 | `870d9b5c5` |
| 1H1 Host 进 boot 默认 off | 完成 | 本刀 |

## 明确未做

1. Named Pipe ACL / Host driver（1NP2）
2. QuickJS Worker
3. Host boot 打开后的真实 UDS supervisor（仍默认 off）
4. Claude / Notes **产品**切流（flag 仍默认 off）
5. 用户数据导入
6. Marketplace

## 进度

相对「Core + 可撤销插件平台」全文约 **99%**（合同平面 **100%**；插座本体 1F spawn+handshake + Named Pipe 闸门 + Host boot 默认 off 已落地；产品拔插头仍 0%）。  
相对「产品已拔插头」约 **0%**。  
插座骨架按当前边界落地；QuickJS / Named Pipe ACL / 产品切流仍未做。
