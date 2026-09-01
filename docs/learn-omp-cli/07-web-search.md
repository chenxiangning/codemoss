# 第七课:Web search 内置 —— 23 个 provider + 站点感知提取

这是 omp 的 08 号电池。在 pi 里你需要自己接 MCP (Model Context Protocol, 模型上下文协议) 或外部 search 工具,omp 直接内置——并且把它做成"读起来像本地文件"。

## 1. 一句话定位

```
pi:  agent 想查 web → 你得自己接 search MCP 或 web_fetch
omp: agent 想查 web → web_search tool → 直接拿到结构化 markdown
```

关键差异是 omp 的 web search **不是"返回 HTML 链接列表"**,而是**返回带锚点 (anchor, 页面内跳转标记) 的 markdown**,agent 可以直接 cite (引用)、follow、quote。

## 2. 23 个 provider 全清单

| provider | auth (鉴权方式) | 备注 |
| ---------- | --------- | ------ |
| `auto` | 链式调用 | **默认**,按顺序试下面这些 |
| `perplexity` | `PERPLEXITY_API_KEY`(无 key 也可走匿名 fallback) | AI 综合答案 |
| `gemini` | OAuth | Google Gemini 搜索 |
| `anthropic` | OAuth | Anthropic 搜索 |
| `codex` | OAuth | OpenAI Codex 搜索 |
| `xai` | OAuth 或 `XAI_API_KEY` | xAI Grok 搜索 |
| `zai` | `ZAI_API_KEY` | GLM 搜索 |
| `exa` | `EXA_API_KEY`(或 MCP) | 向量搜索 |
| `tinyfish` | `TINYFISH_API_KEY` | 小型爬虫搜索 |
| `jina` | `JINA_API_KEY` | Jina 搜索 |
| `kagi` | `KAGI_API_KEY` | Kagi 搜索 |
| `tavily` | `TAVILY_API_KEY` | Tavily 搜索 |
| `firecrawl` | `FIRECRAWL_API_KEY`(keyless fallback) | 爬虫式 |
| `brave` | `BRAVE_API_KEY` | Brave Search |
| `kimi` | `/login kimi-code` 或 search key | Kimi 搜索 |
| `parallel` | `PARALLEL_API_KEY` | Parallel 多源 |
| `synthetic` | `SYNTHETIC_API_KEY` | Synthetic |
| `searxng` | self-hosted (自托管) | 需自己跑 SearXNG 实例 |
| `duckduckgo` | 无 key | DDG |
| `startpage` | 无 key | Startpage |
| `google` | 无 key (browser 兜底) | Google |
| `ecosia` | 无 key (browser 兜底) | Ecosia |
| `mojeek` | 无 key (browser 兜底) | Mojeek |
| `public` | 无 key (上面无 key 的合并) | 公共源整合 |

### 2.1 `auto` 模式怎么走

```yaml
web_search { query: "..." }
# → auto 链:perplexity → gemini → anthropic → codex → xai → zai → exa → ...
# → 任一成功就停,全部失败才报错
```

实际生产中 `auto` 会**按"成功率 × 速度"动态排序**——不是固定顺序。

### 2.2 keyless (无密钥) 也能用

`duckduckgo` / `startpage` / `google` / `ecosia` / `mojeek` / `public` 这 6 个**完全不要 key**。这意味着:

- 你没买 Tavily/Perplexity 也能搜
- 不想付钱就用 keyless 一组
- 但**能力有限**,AI 综合/引用/去重这些**只有付费 provider 提供**

### 2.3 Exa 的特殊双通道

Exa 是个例外:**除了 `EXA_API_KEY`,它还接受 MCP 通道**:

```text
/login exa          # 存 API key
或
/auto-mcp exa       # 接 Exa 的官方 MCP server,免 key
```

显式选 keyless 时,omp 自动 fallback 到 public MCP 路径。

### 2.4 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 内置 web_search | ❌(需接 MCP/外接) | ✅ 23 个 provider |
| `auto` 链式调用 | n/a | ✅ |
| keyless 选项 | n/a | ✅ 6 个 |
| Exa MCP 通道 | n/a | ✅ |

## 3. site-aware extraction (站点感知提取) ——杀手锏

普通 web search 返回 "10 个蓝色链接"。omp 在每个链接之后,会**识别 URL 来自哪种源,调用对应的 extractor (提取器) 抓内容**,转成结构化 markdown。

### 3.1 抓回来什么样

```text
[agent 调用]
web_search { query: "inference-time compute scaling recent papers" }

[omp 返回]
找到 10 个结果:

[1] arxiv.org/abs/2604.10739v1 ← 自动转 markdown
    摘要:本文研究 inference-time (推理时) compute scaling,提出...
    [download PDF]
    # Inference-Time Compute Scaling Laws
    作者:Smith et al. (2026)
    ## Headline Result
    模型在 pass@k 上达到 92%,比 baseline 提升 18pp ...

[2] github.com/anomalyco/opencode ← 自动转 markdown
    # opencode
    ⭐ 12k stars, fork 450
    ## Description
    ...

[3] npmjs.com/package/zod
    # zod
    v3.23.8 · 每周下载 22M · license MIT
    ## Description
    ...
```

每个链接的页面都按其来源**最优形式**返回:

- arxiv → 摘要 + PDF markdown 转换
- GitHub → repo metadata (仓库元数据) + README
- npm → 包元数据 + README
- SO → 答案 + 评论(按票数排序)

### 3.2 链接结构保留

```markdown
详情见 [Anthropic 的 MCP 文档](https://modelcontextprotocol.io/docs)
            ↑
      anchor (锚点) 完整保留
```

agent 可以用 grep / read 反向追溯,**不会丢失上下文**。

## 4. Specialized handlers (专业处理器)

omp 把不同源分成 5 类,每类有专属 extractor。

### 4.1 Code hosts (代码托管平台)

| handler | 干什么 |
|---------|--------|
| `github` | repo / PR / issue / code search / Actions run-watch |
| `gitlab` | 同上(GitLab 版) |

### 4.2 Package registries (包注册中心)

| handler | 平台 |
| --------- | ------ |
| `npm` | Node 包 |
| `pypi` | Python 包 |
| `crates` | crates.io (Rust 包仓库) |
| `hex` | Erlang/Elixir |
| `hackage` | Haskell |
| `nuget` | .NET |
| `maven` | Java |
| `rubygems` | Ruby |
| `packagist` | PHP |
| `pub.dev` | Dart |
| `go` | Go packages |

### 4.3 Research sources (研究来源)

| handler | 平台 |
|---------|------|
| `arxiv` | 学术预印本 |
| `semantic-scholar` | 学术搜索 |

### 4.4 Forums (论坛)

| handler | 平台 |
| --------- | ------ |
| `stackoverflow` | SO |
| `reddit` | Reddit |
| `hn` | Hacker News |

### 4.5 Docs (文档)

| handler | 平台 |
| --------- | ------ |
| `mdn` | Mozilla 开发者网络 |
| `readthedocs` | Read the Docs |
| `docs.rs` | Rust 文档 |

### 4.6 用法

```yaml
web_search {
  query: "zod 文档",
  site: "github.com/colinhacks/zod"
}
# → 自动用 github handler

web_search {
  query: "pydantic v2",
  site: "pypi.org"
}
# → 自动用 pypi handler,返回包元数据 + README markdown
```

或者更精准:

```yaml
read https://arxiv.org/abs/2604.10739v1
# → omp 直接用 arxiv handler 解析,不走 search
```

### 4.7 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 站点感知提取 | ❌ | ✅ 23 个 handler |
| 包仓库专格式 | ❌ | ✅ 11 个 |
| 学术论文转 markdown | ❌ | ✅ arxiv + semantic-scholar |
| 论坛按票数排序 | ❌ | ✅ |

## 5. Security databases (安全数据库) 集成

这是 web_search 的另一面——查漏洞。

| database | 用途 |
| ---------- | ------ |
| `nvd` | National Vulnerability Database (国家漏洞数据库) |
| `osv` | Open Source Vulnerabilities (开源漏洞库) |
| `cisa-kev` | CISA Known Exploited Vulnerabilities (CISA 已知被利用漏洞目录) |

### 5.1 用法

```yaml
web_search {
  query: "log4j vulnerability",
  sources: ["nvd", "osv", "cisa-kev"]
}
# → 返回 3 个数据库的实际厂商数据,不是博客摘要
```

### 5.2 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 漏洞数据库直查 | ❌ | ✅ NVD / OSV / CISA KEV |
| 厂商原始数据 | n/a | ✅(不是二手报道) |

## 6. 实战工作流

### 场景 1:调研一个新库

```yaml
web_search {
  query: "Bun vs Node.js performance benchmarks 2026",
  sources: ["github", "stackoverflow", "reddit"]
}
web_search {
  query: "Bun production adoption stories",
  sources: ["github", "hn"]
}
read https://github.com/oven-sh/bun    # 自动 github handler
read https://bun.sh/docs               # 自动 docs handler
```

### 场景 2:安全审计

```yaml
web_search {
  query: "next-auth CVE vulnerability",
  sources: ["nvd", "osv", "cisa-kev"]
}
# → 拿到厂商漏洞数据,直接告诉你版本是否受影响
```

### 场景 3:CI 出错查 issue

```yaml
web_search {
  query: "rust-analyzer error E0599 my_struct method",
  sources: ["github", "stackoverflow"]
}
# → 命中 issue/PR/答案,直接拿到 markdown
```

### 场景 4:论文复现

```yaml
read https://arxiv.org/abs/2604.10739v1
# → arxiv handler 返回摘要 + 关键章节 + 实验数字
# 你不用读 50 页 PDF,直接 cite 关键结论
```

## 7. 调优

```yaml
# ~/.omp/agent/config.yml
webSearch:
  defaultProvider: "auto"           # 默认 auto
  fallback: ["perplexity", "exa"]   # auto 全失败时走这两个
  handlers:
    arxiv:
      maxPages: 20                  # 最多抓多少页
    github:
      includeReadme: true           # 是否带 README
      includeIssues: false          # 是否带 issue 列表
  security:
    enabled: true
    databases: ["nvd", "osv", "cisa-kev"]
```

## 8. 与 pi 的全景对比

| 维度 | pi | omp |
| ------ | ----- | ----- |
| 内置 web search | ❌ | ✅ 23 provider |
| `auto` 链 | n/a | ✅ |
| keyless 选项 | n/a | ✅ 6 个 |
| 站点感知提取 | ❌ | ✅ 23 个 handler |
| 学术论文 markdown | ❌ | ✅ arxiv + semantic-scholar |
| 漏洞数据库直查 | ❌ | ✅ NVD / OSV / CISA KEV |
| 锚点保留 | ❌ | ✅ |
| 与本地工具统一 | n/a | ✅ `read https://...` 像读文件 |

## ✅ 小结

| 能力 | 干什么 |
| ------ | -------- |
| 23 provider | 涵盖付费 / OAuth / keyless / self-hosted |
| `auto` 链 | 按成功率动态排序 |
| site-aware extraction | 每个源走专属 handler |
| 23 specialized handlers | code hosts / registries / research / forums / docs |
| Security databases | NVD / OSV / CISA KEV 厂商原始数据 |

和 pi 的对照:**pi 搜到的是"链接列表",omp 搜到的是"已经读完的结构化 markdown"**——这就是 README 里 "agent gets structured content, not stripped HTML" 的意思。

## 🎯 下一课预告:第八课:`omp commit` 原子化

- 怎么读 `git_overview` / `git_file_diff` / `git_hunk` 拆无关改动为原子 commit
- cycle (循环依赖) 检测 + 拒绝
- 优先级评分:源码 > 测试 > 文档 > 配置
- lockfile 自动排除,不参与分析
