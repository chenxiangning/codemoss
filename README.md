<div align="center">

# Desktop CC GUI

<img width="120" alt="ccgui icon" src="./icon.png" />

**English** · [简体中文](./README.zh-CN.md)

<a href="https://trendshift.io/repositories/25546" target="_blank"><img src="https://trendshift.io/api/badge/repositories/25546" alt="zhukunpenglinyutong%2Fdesktop-cc-gui | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

![][github-contributors-shield] ![][github-forks-shield] ![][github-stars-shield] ![][github-issues-shield]

</div>

**ccgui** is an open-source desktop client for AI coding. In plain words: it brings command-line AI coding runtimes such as Claude Code, Codex CLI, Gemini CLI, and OpenCode into one graphical interface.

No more staring at a black terminal. Open ccgui, pick a project, and chat with AI to write code, fix bugs, and commit to Git. File and tool activity is visible as it happens; token usage and estimated cost appear when the selected runtime supplies the required metadata.

The app is built with **Tauri 2 + React 19 + TypeScript + Rust** and runs on macOS, Windows, and Linux. App settings, workspace indexes, and client state are persisted locally by default. Content sent to an AI provider, Browser Agent, email service, or an optional remote/web service follows the boundary of that configured service.

<img src="./docs/banner.png" alt="ccgui screenshot" width="800" />

---

## What can ccgui do?

### One client, multiple AI engines

- Registers runtime adapters for **Claude Code**, **Codex CLI**, **Gemini CLI**, and **OpenCode**. Gemini is enabled by default; OpenCode is optional. Their planned retirement remains an active migration, not shipped behavior.
- Claude and Codex support managed provider profiles. Gemini and OpenCode retain the provider/configuration model exposed by their own runtimes.
- Sessions survive restarts: close the app and your conversation history is still there. Resume broken sessions and see how much context each one is using.

### A chat box designed for coding

- The input box supports `@` file references, slash commands, pasted images, and attachments.
- Supported file edits, shell/tool calls, and reads show up as live cards.
- Claude/Codex sessions expose **rewind** and **fork** where the current runtime capability supports them.
- Too lazy to type? Use **voice dictation**. Bad at prompts? The built-in **prompt enhancer** polishes them for you.
- Queue follow-ups: while the AI is busy, line up your next question.

### Not just chat — a full set of dev panels

- **File tree**: browse, preview, copy, paste, rename, and drag files straight into the conversation.
- **Built-in terminal**: a real terminal, no need to switch windows.
- **Git panel**: stage, commit (with AI-generated commit messages), branches, worktrees, diffs, and commit history.
- **Global search**: files, sessions, past messages, skills, and commands — one search box for everything.

### Stay organized when tasks pile up

- **Plan panel**: the AI's execution plan listed step by step, so you always know where it is.
- **Kanban board**: drag task cards around to manage your iteration.
- **Task Center**: inspect Kanban/orchestration task runs, logs, and artifact summaries; retry, resume, cancel, or fork when the run and engine support that action.
- **Intent Canvas**: sketch your plan on a canvas before writing any code.

### Project intelligence (the part that makes ccgui different)

- **Project Map**: the AI scans your project and builds an interactive knowledge graph — file relations, API contracts, and module dependencies at a glance, with incremental updates.
- **Project Memory**: store key conventions and lessons, then inject selected memories with `@@` or explicitly enable Memory Reference retrieval for the current turn.
- **Context Ledger**: inspect selected or inherited context sources together with available token/character estimates, freshness, and attribution confidence.
- **Usage stats**: inspect token, cache, and estimated-cost metadata when the runtime provides it. Monthly budget thresholds are local visual guidance; they do not interrupt the runtime.

### Extensions and personalization

- Discover and manage available MCP servers and Skills, and enable bundled curated skills. MCP/Plugin marketplace entries are currently **Coming Soon**.
- **Browser Agent**: open policy-allowed HTTP(S) pages and collect bounded read-only context. Snapshot/navigation support can degrade by platform; element and form actions are not yet supported.
- **21 built-in VS Code-derived themes**, plus user-message color, window transparency, and UI/code font controls.
- The WebView UI ships **10 languages**. The native desktop menu is localized for Chinese and English today; other locales fall back to Chinese. Composer, panel, navigation, and file-action shortcuts are configurable.
- macOS / Windows / Linux, with in-app **auto-update**.

For what changed in each release, see [CHANGELOG.md](./CHANGELOG.md).

---

## Download

Grab the installer for your platform from the [Releases page](https://github.com/zhukunpenglinyutong/desktop-cc-gui/releases):

| Platform | Installer |
| --- | --- |
| macOS (Apple Silicon) | `aarch64.dmg` |
| macOS (Intel) | `x64.dmg` |
| Windows | `.exe` (NSIS) |
| Linux | `.AppImage` |

After installing, configure your AI engine in Settings (e.g. a Claude Code API key or local CLI), add a project folder, and you're good to go.

---

## Getting it running (setup guide)

Want to build it yourself or contribute? Three steps.

### Step 1: Prepare your environment

You need these three things:

| Tool | Version | What for |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 20 or newer | Runs the frontend |
| [Rust](https://rustup.rs/) | stable (install via rustup) | Compiles the backend |
| [CMake](https://cmake.org/download/) | any recent version | Builds some dependencies |

Each OS needs a bit of extra prep (these are Tauri framework requirements — see the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)):

- **macOS**: install Xcode command line tools: `xcode-select --install`; get CMake via `brew install cmake`.
- **Windows**: install Microsoft C++ Build Tools and WebView2 (Windows 11 ships with WebView2).
- **Linux**: install `webkit2gtk` and friends — just copy the commands from the Tauri docs.

### Step 2: Install dependencies

```bash
git clone https://github.com/zhukunpenglinyutong/desktop-cc-gui.git
cd desktop-cc-gui
npm install
```

Note: **you must use npm**. pnpm and yarn are blocked by a script (so everyone gets identical dependency versions).

### Step 3: Start it

```bash
# macOS / Linux
npm run tauri:dev

# Windows
npm run tauri:dev:win
```

A few tips:

- **The first launch compiles the entire Rust backend and can take a few minutes** — go grab a coffee. Later launches use incremental builds and are fast.
- An environment self-check (doctor) runs before startup. If it fails, run `npm run doctor` by itself — it tells you what's missing and how to install it.
- The frontend runs on port `1420`. Don't worry if the port is taken; the script cleans it up automatically.
- Only touching the UI, not Rust? `npm run dev` runs the frontend alone in a browser (backend-dependent features won't work there).

### Building installers

```bash
npm run build:mac-arm64      # macOS Apple Silicon
npm run build:mac-x64        # macOS Intel
npm run build:mac-universal  # macOS Universal
npm run build:win-x64        # Windows x64
npm run build:linux-x64      # Linux x64
npm run build:linux-arm64    # Linux arm64
```

---

## How to work on the code (development guide)

### Tech stack at a glance

| Part | Technology |
| --- | --- |
| UI | React 19 + TypeScript + Tailwind CSS 4 |
| Build | Vite 7 |
| Desktop shell | Tauri 2 (Rust backend) |
| Tests | Vitest (frontend) + cargo test (Rust) |

### Directory layout

```text
desktop-cc-gui/
├── src/                    # Frontend code
│   ├── features/           # ★ Feature modules (50+), one folder per feature — where most work happens
│   │   ├── composer/       #    Input box
│   │   ├── messages/       #    Message stream
│   │   ├── git/            #    Git panel
│   │   ├── project-map/    #    Project knowledge map
│   │   └── ...             #    Each folder is a self-contained feature
│   ├── components/         # Shared UI components used across features
│   ├── services/           # Business logic; services/tauri/* contains frontend↔Rust wrappers
│   ├── i18n/               # 10 shipped WebView locale bundles
│   ├── styles/             # Global styles
│   └── lib/ utils/         # Utility functions
├── src-tauri/              # Rust backend
│   └── src/                # Organized by module: engine / codex / git / terminal / files ...
├── scripts/                # Build, check, and diagnostic scripts
└── docs/                   # Architecture docs, performance baselines
```

### The typical workflow for changing a feature

1. **UI-only change**: find the matching module under `src/features/` and edit there. New components live inside that feature's own folder.
2. **Needs backend support**: add a `#[tauri::command]` in the matching `src-tauri/src/` module, register it in `src-tauri/src/command_registry.rs`, and add the frontend wrapper under `src/services/tauri/<domain>.ts` (re-export it from `src/services/tauri.ts` when needed).
3. **Changed any UI text**: route it through i18n and keep every shipped bundle under `src/i18n/locales/` synchronized — hardcoded UI text is not allowed.

### Everyday commands

| Command | What it does |
| --- | --- |
| `npm run tauri:dev` | Start the full app (dev mode) |
| `npm run dev` | Frontend only (browser debugging) |
| `npm run lint` | Code style check |
| `npm run typecheck` | TypeScript type check |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Watch mode (test while you code) |
| `npm run test:integration` | Full run including heavy integration tests |

### Writing tests

- Test files sit next to the source, named `xxx.test.ts` / `xxx.test.tsx`.
- The framework is [Vitest](https://vitest.dev/) — it works almost exactly like Jest.
- Heavy integration tests are named `xxx.integration.test.tsx`; they're skipped by default and run with `npm run test:integration`.
- Rust tests go in their modules as usual and run from the repository root with `cargo test --manifest-path src-tauri/Cargo.toml`.

---

## Coding rules

Not many rules, but each exists for a reason. Run through them before submitting:

1. **Run the big three before committing**: `npm run lint && npm run typecheck && npm run test` — all green before you push. The current CI workflow runs on pushes to `main` and by manual dispatch, so local evidence is required before opening a PR.
2. **UI text must go through i18n**: every user-visible string comes from `src/i18n/`, and every shipped locale bundle must remain synchronized. No hardcoding.
3. **Keep components close to home**: new components start inside their own feature folder; promote to `src/components/` only once they're genuinely reused across features.
4. **Prefix CSS classes by feature**: e.g. the Git history panel uses `git-history-*` class names, so styles from different features don't fight each other.
5. **Respect the large-file policy**: new files use an 800-line ratchet and existing areas use 2600/2800/3000-line hard thresholds. `npm run check:large-files` reports; `npm run check:large-files:gate` is the blocking check.
6. **TypeScript strict mode**: don't paper over things with `any`; write real types.
7. **Rust file writes go through the shared helper**: use the atomic write in `storage.rs` instead of raw `write`, so a crash mid-write can't corrupt user data.
8. **Search before adding a Tauri command**: `command_registry` may already have what you need — don't reinvent it.
9. **Never commit secrets**: API keys and tokens must never appear in code or commit history.

### Writing commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with a Chinese action phrase by default: `type(scope): 中文动宾短句`.

| type | When to use |
| --- | --- |
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Refactoring (no behavior change) |
| `docs` | Documentation |
| `test` | Adding/updating tests |
| `chore` | Housekeeping (version bumps, deps, scripts) |
| `perf` / `style` / `ci` | Performance / formatting / CI |

Real examples:

```text
feat(composer): 支持粘贴图片转为附件
fix(git): 修复 diff 面板滚动位置丢失
docs(readme): 校准项目文档索引
```

No emoji in commit messages, and no AI-generated signatures.

---

## Submitting your code (contribution flow)

1. **Fork** the repo and clone it locally.
2. Branch off `main`, named like `feat/xxx` or `fix/xxx`.
3. Make your changes and get the big three green locally (`lint` / `typecheck` / `test`).
4. Open a PR against this repo's **`main` branch**. Title in commit format; in the description, explain what changed, why, and how you verified it.
5. Attach local verification evidence to the PR. The current CI workflow runs on pushes to `main` and by manual dispatch; do not assume that opening a PR starts it automatically. Medium/high-risk review findings must be fixed before merging.

Not sure where to start? Browse the [Issues](https://github.com/zhukunpenglinyutong/desktop-cc-gui/issues) and pick one that interests you. Found a bug or have an idea? Open an issue and let's talk.

### Want to dig deeper into the project's internals?

- [AGENTS.md](AGENTS.md) — the entry point for repository rules (required reading if you develop this project with AI assistance).
- [Documentation hub](docs/README.md) — architecture, performance, plans, research, and dated evidence with explicit truth boundaries.
- [dev-guidelines/](dev-guidelines/) — detailed frontend and backend implementation specs.
- [OpenSpec workspace](openspec/README.md) — behavior specs, workflow, and governance overview.
- [Main capability spec index](openspec/specs/README.md) — all synced mainline behavior contracts.
- [Active proposal index](openspec/changes/README.md) — current changes, progress, closure gates, and artifact links.
- [Archived proposal index](openspec/changes/archive/README.md) — all archived proposals grouped by month and archive date.
- [OpenSpec audit/evidence index](openspec/docs/README.md) — durable references and dated governance snapshots.

---

## License

[MIT](https://github.com/zhukunpenglinyutong/desktop-cc-gui?tab=MIT-1-ov-file)

---

## Friendship Link

Thanks for the support and feedback from the friends at [LINUX DO](https://linux.do/).

---

## Contributors

Thanks to all the contributors who help make ccgui better.

<a href="https://github.com/zhukunpenglinyutong/desktop-cc-gui/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=zhukunpenglinyutong/desktop-cc-gui" alt="Contributors" />
</a>

---

## Acknowledgements

1. This project originally started from [CodexMonitor](https://github.com/Dimillian/CodexMonitor).
2. The Usage Statistics extension module is mainly based on the source code of [TokenTracker](https://github.com/mm7894215/TokenTracker).

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=zhukunpenglinyutong/desktop-cc-gui&type=date&legend=top-left)](https://www.star-history.com/#zhukunpenglinyutong/desktop-cc-gui&type=date&legend=top-left)

<!-- LINK GROUP -->

[github-contributors-shield]: https://img.shields.io/github/contributors/zhukunpenglinyutong/desktop-cc-gui?color=c4f042&labelColor=black&style=flat-square
[github-forks-shield]: https://img.shields.io/github/forks/zhukunpenglinyutong/desktop-cc-gui?color=8ae8ff&labelColor=black&style=flat-square
[github-issues-link]: https://github.com/zhukunpenglinyutong/desktop-cc-gui/issues
[github-issues-shield]: https://img.shields.io/github/issues/zhukunpenglinyutong/desktop-cc-gui?color=ff80eb&labelColor=black&style=flat-square
[github-license-link]: https://github.com/zhukunpenglinyutong/desktop-cc-gui/blob/main/LICENSE
[github-stars-shield]: https://img.shields.io/github/stars/zhukunpenglinyutong/desktop-cc-gui?color=ffcb47&labelColor=black&style=flat-square
