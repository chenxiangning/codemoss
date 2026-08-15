# Design

`allow_mossx_bridge` 改成整段匹配 `^mossx\.(handshake|sdk)\.[A-Za-z_][A-Za-z0-9_]*\(\)$`。`mossx.handshake.hello();1+1` 不得进 `EngineCmd::Eval`。测试断言该源码 `permission-denied`，且随后合法 `hello()` 仍成功。
