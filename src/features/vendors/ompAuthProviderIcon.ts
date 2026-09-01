/**
 * OMP auth-broker provider id → 品牌 SVG。
 *
 * `omp auth-broker list` 返回 60+ 个可登录供应商目录，id 与 mossx 预设
 * 品牌体系不同源（github-copilot / google-gemini-cli / minimax-code-cn…），
 * resolveProviderBrandIcon 的 model/preset 匹配覆盖不了。此处按精确 id +
 * 前缀规则映射到 lobehub 品牌 SVG；未命中的 id 由调用方用首字母瓦片兜底。
 */
import alibabaIcon from "@lobehub/icons-static-svg/icons/alibaba-color.svg";
import antigravityIcon from "@lobehub/icons-static-svg/icons/antigravity-color.svg";
import basetenIcon from "@lobehub/icons-static-svg/icons/baseten.svg";
import cerebrasIcon from "@lobehub/icons-static-svg/icons/cerebras-color.svg";
import cloudflareIcon from "@lobehub/icons-static-svg/icons/cloudflare-color.svg";
import copilotIcon from "@lobehub/icons-static-svg/icons/copilot-color.svg";
import cursorIcon from "@lobehub/icons-static-svg/icons/cursor.svg";
import devinIcon from "@lobehub/icons-static-svg/icons/devin-color.svg";
import deepinfraIcon from "@lobehub/icons-static-svg/icons/deepinfra-color.svg";
import exaIcon from "@lobehub/icons-static-svg/icons/exa-color.svg";
import fireworksIcon from "@lobehub/icons-static-svg/icons/fireworks-color.svg";
import geminiCliIcon from "@lobehub/icons-static-svg/icons/geminicli.svg";
import huggingfaceIcon from "@lobehub/icons-static-svg/icons/huggingface-color.svg";
import kagiIcon from "@lobehub/icons-static-svg/icons/kagi.svg";
import metaIcon from "@lobehub/icons-static-svg/icons/meta-color.svg";
import nvidiaIcon from "@lobehub/icons-static-svg/icons/nvidia-color.svg";
import novitaIcon from "@lobehub/icons-static-svg/icons/novita-color.svg";
import ollamaIcon from "@lobehub/icons-static-svg/icons/ollama.svg";
import perplexityIcon from "@lobehub/icons-static-svg/icons/perplexity-color.svg";
import tavilyIcon from "@lobehub/icons-static-svg/icons/tavily-color.svg";
import togetherIcon from "@lobehub/icons-static-svg/icons/together-color.svg";
import vercelIcon from "@lobehub/icons-static-svg/icons/vercel.svg";
import xaiIcon from "@lobehub/icons-static-svg/icons/xai.svg";
import zaiIcon from "@lobehub/icons-static-svg/icons/zai.svg";
import zenmuxIcon from "@lobehub/icons-static-svg/icons/zenmux.svg";
import opencodeIcon from "@lobehub/icons-static-svg/icons/opencode.svg";
import {
  ANTHROPIC_BRAND_ICON_SRC,
  PROVIDER_BRAND_ICON_SRC,
  QWEN_BRAND_ICON_SRC,
} from "./providerBrandIcon";

const EXACT_PROVIDER_ICON_SRC: Record<string, string> = {
  anthropic: ANTHROPIC_BRAND_ICON_SRC,
  "openai-codex": PROVIDER_BRAND_ICON_SRC.openai,
  "openai-codex-device": PROVIDER_BRAND_ICON_SRC.openai,
  zai: zaiIcon,
  "zai-coding-plan": zaiIcon,
  "kimi-code": PROVIDER_BRAND_ICON_SRC.kimi,
  moonshot: PROVIDER_BRAND_ICON_SRC.moonshot,
  openrouter: PROVIDER_BRAND_ICON_SRC.openrouter,
  "github-copilot": copilotIcon,
  cursor: cursorIcon,
  devin: devinIcon,
  "google-antigravity": antigravityIcon,
  "google-gemini-cli": geminiCliIcon,
  xai: xaiIcon,
  "xai-oauth": xaiIcon,
  "alibaba-coding-plan": alibabaIcon,
  "alibaba-token-plan": QWEN_BRAND_ICON_SRC,
  "qwen-portal": QWEN_BRAND_ICON_SRC,
  "zhipu-coding-plan": PROVIDER_BRAND_ICON_SRC.zhipu,
  "minimax-code": PROVIDER_BRAND_ICON_SRC.minimax,
  "minimax-code-cn": PROVIDER_BRAND_ICON_SRC.minimax,
  xiaomi: PROVIDER_BRAND_ICON_SRC.xiaomi,
  deepseek: PROVIDER_BRAND_ICON_SRC.deepseek,
  meta: metaIcon,
  cerebras: cerebrasIcon,
  baseten: basetenIcon,
  fireworks: fireworksIcon,
  together: togetherIcon,
  nvidia: nvidiaIcon,
  novita: novitaIcon,
  deepinfra: deepinfraIcon,
  huggingface: huggingfaceIcon,
  perplexity: perplexityIcon,
  ollama: ollamaIcon,
  "vercel-ai-gateway": vercelIcon,
  "cloudflare-ai-gateway": cloudflareIcon,
  "opencode-zen": opencodeIcon,
  "opencode-go": opencodeIcon,
  tavily: tavilyIcon,
  kagi: kagiIcon,
  exa: exaIcon,
  zenmux: zenmuxIcon,
  longcat: PROVIDER_BRAND_ICON_SRC.longcat,
};

/** id 前缀 → 品牌（精确表未命中时兜底，覆盖 token-plan / regional 变体）。 */
const PREFIX_PROVIDER_ICON_RULES: ReadonlyArray<readonly [string, string]> = [
  ["xiaomi", PROVIDER_BRAND_ICON_SRC.xiaomi],
  ["minimax", PROVIDER_BRAND_ICON_SRC.minimax],
  ["alibaba", alibabaIcon],
  ["qwen", QWEN_BRAND_ICON_SRC],
  ["zhipu", PROVIDER_BRAND_ICON_SRC.zhipu],
  ["gitlab", ""], // 无品牌 SVG，显式置空 → 首字母瓦片
];

export function resolveOmpAuthProviderIcon(providerId: string): string | null {
  const normalized = providerId.trim().toLowerCase();
  const exact = EXACT_PROVIDER_ICON_SRC[normalized];
  if (exact) {
    return exact;
  }
  for (const [prefix, src] of PREFIX_PROVIDER_ICON_RULES) {
    if (normalized.startsWith(prefix)) {
      return src || null;
    }
  }
  return null;
}
