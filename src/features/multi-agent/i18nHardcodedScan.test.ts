import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 防回退：multi-agent 用户可见路径不得残留中文硬编码 JSX/字符串。
 * 协议文本 / 模型 prompt / 诊断匹配字面量显式豁免。
 */

const ROOT = join(process.cwd(), "src/features/multi-agent");

/** 相对 multi-agent 根的路径；这些文件允许协议/模型文案硬编码 */
const ALLOW_PATH_PREFIXES = [
  "utils/collabPrompt.ts", // 模型协议 marker 与调度 prompt
  "runtime/mainCanvasContextInjection.ts", // 主幕 digest 模型侧协议 marker
  "runtime/skillContextInjection.ts", // skill 正文注入模型侧前缀
  "templates/builtin.ts", // 内置 rolePrompt（喂模型）；展示走 multiAgent.builtin.*
  "hooks/useAgentStageTranscript.ts", // 弱状态词正则含中英
];

/** 行级豁免：诊断匹配 / 模型侧前缀 / defaultValue 回退 */
const ALLOW_LINE_PATTERNS = [
  /defaultValue\s*:/,
  /d\.includes\(/,
  /item\.includes\(/,
  /includes\("打回重规划"\)/,
  /includes\("reject replan"\)/,
  /【智能体：/, // legacy / 展示协议
  /【智能体角色指令】/, // Rust 侧叠层（若前端镜像）
  /【打回补充】/, // executor → 模型任务续写
  /【批准时用户补充】/, // backend stage prompt 注入（前端若镜像）
  /【节点重试】/, // executor → 模型任务续写
  /节点原文已截断供概括/, // 汇总 turn 模型摘录
  /isWeakStatusText|成功|完成|失败|取消/, // 状态弱文案正则
  /^\s*\/\//, // 注释
  /^\s*\*/, // block comment
];

const SCAN_EXTS = new Set([".ts", ".tsx"]);
const CHINESE_IN_STRING =
  /(["'`])(?:(?!\1)[\s\S])*[\u4e00-\u9fff](?:(?!\1)[\s\S])*\1/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      walk(full, out);
      continue;
    }
    const ext = name.slice(name.lastIndexOf("."));
    if (!SCAN_EXTS.has(ext)) continue;
    if (name.includes(".test.") || name.includes(".spec.")) continue;
    out.push(full);
  }
  return out;
}

function isAllowedPath(rel: string): boolean {
  return ALLOW_PATH_PREFIXES.some(
    (prefix) => rel === prefix || rel.startsWith(`${prefix}/`),
  );
}

function isAllowedLine(line: string): boolean {
  return ALLOW_LINE_PATTERNS.some((re) => re.test(line));
}

describe("multi-agent i18n hardcode scan", () => {
  it("components + user-facing runtime have no Chinese string literals (except allowlist)", () => {
    const files = walk(ROOT);
    const hits: string[] = [];

    for (const file of files) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (isAllowedPath(rel)) continue;
      // store / 纯类型 / featureFlag 等无 UI 文案
      if (
        rel.startsWith("store/") ||
        rel === "types.ts" ||
        rel.startsWith("runtime/featureFlag") ||
        rel.startsWith("runtime/livePhaseChannel") ||
        rel.startsWith("runtime/agentCanvasThread") ||
        rel.startsWith("runtime/contextGate") ||
        rel.startsWith("utils/canvasItems") ||
        rel.startsWith("utils/stageBodyText") ||
        rel.startsWith("templates/targetCompleteness") ||
        rel.startsWith("templates/templateStore")
      ) {
        continue;
      }

      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (isAllowedLine(line)) return;
        if (!CHINESE_IN_STRING.test(line)) return;
        hits.push(`${rel}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(hits, hits.join("\n")).toEqual([]);
  });
});
