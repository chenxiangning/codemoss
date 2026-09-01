# 第十三课:browser + computer + 多模态

omp 的 20 + 21 号电池,以及多模态工具集——agent 不止能写代码,还能**操作桌面和生成/理解多媒体**。

## 1. browser 工具(20 号电池前半)

### 1.1 三种启动模式

| 模式 | 含义 | 适用 |
| ------ | ------ | ------ |
| headless Chromium (无头浏览器, 无 UI 后台跑) | 完全无 UI,最快 | 后台抓数据 |
| CDP-attached Electron app (Chrome DevTools Protocol 附加 Electron 应用) | 把任意 Electron app 当浏览器 | 操作 Slack / VSCode / Notion |
| Chrome relay extension | 用**你自己**开着的 Chrome | 不偷焦点、复用 cookie |

### 1.2 stealth (隐蔽) 默认开

```
普通 Playwright:
 网站能识别你是 bot (机器人) → 被反爬

omp browser:
 stealth 默认开 → 模拟真实 Chrome 用户 → 难识别
```

> "Stealth's on by default, so pages see a normal user instead of a headless bot."

### 1.3 实战场景

#### 场景 1:headless 抓数据

```text
browser { action: "navigate", url: "https://example.com" }
browser { action: "extract", selector: ".item" }
// → 返回结构化数据
```

#### 场景 2:操作 Slack

```text
browser {
  app: "slack",         # 通过 CDP 接 Slack 桌面 app
  action: "open_channel",
  channel: "#general"
}
browser { action: "read_messages", count: 5 }
// → 拿到最近 5 条 DM
```

#### 场景 3:不抢你的 Chrome

```text
# 你 Chrome 开着 5 个标签
browser {
  mode: "relay",        # 用 Chrome relay extension
  url: "https://..."
}
// → 在你的一个新 tab 打开,不打断你
// → 用你已有的 cookie / 登录态
```

### 1.4 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| Headless browser | ❌ | ✅ |
| Electron app 操作 | ❌ | ✅(CDP) |
| Chrome relay | ❌ | ✅ |
| Stealth 默认 | ❌ | ✅ |

## 2. computer 工具(21 号电池)——桌面控制

### 2.1 是什么

**不是** browser tool。**直接操作你正在用的桌面**——窗口、截图、native input、AX tree、剪贴板。

```
browser   → 在浏览器/网页世界里
computer  → 在 OS 桌面世界里
```

### 2.2 能力清单

| 能力 | 干什么 |
| ------ | -------- |
| 列举窗口 | `computer.listWindows()` |
| 列举显示器 | `computer.listDisplays()` |
| 截图 | `computer.captureScreen()` |
| Native input | mouse / keyboard 模拟 |
| AX tree | OS accessibility (可访问性) tree,读 UI 结构 |
| 剪贴板 | read / write clipboard |

### 2.3 持久 JS 通道

`computer` 跑的是**持久 JavaScript session**,不是一次性脚本:

```text
computer {
  action: "run",
  code: "const windows = listWindows(); windows.find(w => w.title.includes('Slack'))"
}
// → 返回 Slack 窗口对象
```

之后这个 JS 上下文**还活着**,下次调用可以接着用变量:

```text
computer {
  action: "run",
  code: "slackWindow.focus(); sendKeys('hello')"
}
```

### 2.4 实战场景

#### 场景 1:截图 + 视觉模型理解

```text
computer { action: "captureScreen" }
// → 拿到桌面截图

inspect_image { file: "<screenshot>" }
// → vision model 分析,告诉你屏幕上有什么
```

#### 场景 2:跨 app 自动化

```text
computer.listWindows()
// 看到:VSCode, Chrome, Slack

// 在 Chrome 选中一段,拷到剪贴板
computer { action: "copySelection", window: "Chrome" }
// 在 Slack 粘贴
computer { action: "paste", target: "Slack" }
```

#### 场景 3:UI 测试

```text
computer { action: "navigate", to: "MyApp" }
computer { action: "click", selector: "Sign In" }
computer { action: "type", text: "user@example.com" }
// → 自动跑 UI 测试
```

### 2.5 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 桌面控制 | ❌ | ✅ `computer` |
| 持久 JS | n/a | ✅ |
| AX tree | ❌ | ✅ |
| 剪贴板 | ❌ | ✅ |
| Native input | ❌ | ✅ |

## 3. 多模态工具

### 3.1 generate_image(生成图片)

```text
generate_image {
  prompt: "一只穿着宇航服的猫,星空背景",
  model: "openai/gpt-image-1",    # 或 gemini / xai-grok-image
  size: "1024x1024",
  output: "~/Pictures/avatar.png"
}
```

| 提供方 | 模型 |
|--------|------|
| OpenAI | gpt-image-1 |
| Google | imagen-3, gemini-2.5-flash-image |
| xAI | grok-image |

### 3.2 inspect_image(本地图片理解)

```
[用户]
看 ~/Downloads/design.png,这个 mockup 有什么问题?

[agent]
inspect_image { file: "~/Downloads/design.png" }
// → vision model 描述:这张图是登录页 mockup,
//   主按钮颜色对比度不够,左边对齐有问题...
```

| 提供方 | 模型 |
|--------|------|
| Anthropic | claude-sonnet-4.5 |
| OpenAI | gpt-5.5-vision |
| Google | gemini-3-flash |

**auto-activation (自动激活)**:主模型**不能看图时**,`inspect_image` 自动激活并把描述传给主模型——用户无感。

### 3.3 tts(文字转语音)

```text
tts {
  text: "Welcome to omp CLI tutorial",
  voice: "adam",      # 5 个内置 voice
  format: "wav",      # 或 mp3
  output: "~/welcome.wav"
}
```

| voice (音色) | 风格 |
| ------ | ------ |
| adam | 中性 |
| rachel | 温柔 |
| domi | 强势 |
| bella | 平静 |
| elli | 青年 |

提供方:xAI Grok Voice (目前 omp 默认走 xAI)。

### 3.4 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| generate_image | ❌ | ✅ |
| inspect_image | ❌ | ✅ |
| tts | ❌ | ✅ |
| auto-activation | n/a | ✅(主模型不看图时自动) |

## 4. 设置门控

所有这些工具都是**setting-gated (配置开关控制)**,默认关闭:

```yaml
# ~/.omp/agent/config.yml
tools:
  xdev: true            # 启用 xd:// discoverable devices
  github: true          # 启用 github 工具
  security_scan: true   # 启用安全扫描
  generate_image: true  # 启用图像生成
  tts: true             # 启用 TTS
  computer: true        # 启用桌面控制(高权限,默认关闭)
  browser: true         # 启用浏览器控制
```

`inspect_image` 是唯一**自动激活**的——主模型看不见时自动启用,不需要单独配置。

## 5. 实战综合

```text
[用户]
帮我录一个 5 分钟的产品介绍视频,内容包括:
 1. 设计图(我用 Figma)
 2. 截屏 demo
 3. 用 TTS 配音

[agent /vibe 模式下派 worker]

worker 1 (generate_image):
  读 Figma design.png → generate 4 张产品图

worker 2 (computer + browser):
 截屏 demo 操作流程 → 合成 5 分钟 screencast

worker 3 (tts):
 脚本 → 5 分钟配音 → 合成

worker 4 (video compose):
 拼图 + 配音 → 最终 mp4

director 给你确认
```

## 6. 与 pi 的全景对比

| 维度 | pi | omp |
| ------ | ----- | ----- |
| Headless browser | ❌ | ✅ stealth 默认 |
| Electron 操作 | ❌ | ✅ |
| Chrome relay | ❌ | ✅ |
| 桌面控制 | ❌ | ✅ `computer` |
| 持久 JS | ❌ | ✅ |
| generate_image | ❌ | ✅ |
| inspect_image | ❌ | ✅ |
| tts | ❌ | ✅ |

## ✅ 小结

| 武器 | 干什么 |
| ------ | -------- |
| `browser` | headless / CDP / Chrome relay |
| `computer` | 桌面控制(JS 持久化) |
| `generate_image` | AI 生图 |
| `inspect_image` | 看图,主模型看不见时自动 |
| `tts` | xAI 文字转语音 |

和 pi 的对照:**pi 是文本世界,omp 是浏览器 + 桌面 + 视觉 + 听觉**——这是真正的"IDE-wired"延伸到整个工作站。

## 🎯 下一课预告:第十四课:与 pi 终极对比 + 实战综合

- 6 个 Rust crate 深度回顾
- 什么时候用 omp / 什么时候用 pi / 什么时候用 opencode
- 学习路径复盘
