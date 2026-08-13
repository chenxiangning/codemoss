/**
 * Claude managed 供应商：catalog entry id → runtime model 单源解析。
 *
 * 防止 UI 显示 deepseek-v4-pro（映射标签）而 send / --model 仍带 Kimi 残留 `k3`。
 * @see openspec/changes/fix-native-claude-provider-runtime-model-sync
 *
 * 与 freeform 共存：catalog 命中 entry 时始终用 entry.model；
 * 仅对「跨供应商残留」自动 repair，不吞合法自定义模型名。
 */

export type ClaudeRuntimeCatalogEntry = {
  id: string;
  model?: string | null;
  isDefault?: boolean;
};

const PROFILE_ENV_MODEL_SLOTS = [
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_FABLE_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_REASONING_MODEL",
] as const;

/**
 * 跨供应商残留启发式：出现在「当前 catalog 未收录」时才触发 repair。
 * 不把合法 freeform（如 claude-opus-4-6、用户自定义名）当成脏数据。
 *
 * 并行 native 事故：仅 kimi 启发式时，DeepSeek catalog 会 freeform 放行
 * `MiniMax-M3` → 第三方 API 400。扩展常见产品/品牌 residual，仍要求
 * `!legal.has(value)` 才 repair（catalog/env 合法名优先）。
 */
const FOREIGN_RUNTIME_RESIDUE_HINTS = [
  // Kimi
  /^k3$/i,
  /^kimi-/i,
  /^kimi-code\//i,
  // MiniMax（并行 native 截图事故）
  /minimax/i,
  // 其它常见 managed 第三方产品名（未在合法集时才 residual）
  /deepseek/i,
  /^glm-/i,
  /qwen/i,
  /doubao/i,
  /moonshot/i,
  /^abab/i,
  /^ernie/i,
  /baichuan/i,
  /^yi-/i,
  /^step-/i,
  /longcat/i,
] as const;

export function buildLegalClaudeRuntimes(
  catalog: readonly ClaudeRuntimeCatalogEntry[],
  profileEnv?: Record<string, unknown> | null,
): Set<string> {
  const legal = new Set<string>();
  for (const entry of catalog) {
    const runtime = entry.model?.trim() || entry.id.trim();
    if (runtime) {
      legal.add(runtime);
    }
  }
  if (profileEnv && typeof profileEnv === "object") {
    for (const key of PROFILE_ENV_MODEL_SLOTS) {
      const raw = profileEnv[key];
      if (typeof raw === "string" && raw.trim()) {
        legal.add(raw.trim());
      }
    }
  }
  return legal;
}

export function isForeignClaudeRuntimeResidue(runtime: string): boolean {
  const trimmed = runtime.trim();
  if (!trimmed) {
    return false;
  }
  return FOREIGN_RUNTIME_RESIDUE_HINTS.some((pattern) => pattern.test(trimmed));
}

export type ResolveClaudeManagedRuntimeResult = {
  /** 传给 CLI --model 的 runtime */
  runtime: string | null;
  /** 应对齐的 catalog entry id（freeform 时可为 runtime 自身） */
  entryId: string | null;
  /** 是否因跨供应商残留而改写到默认 */
  repaired: boolean;
};

function pickDefaultEntry(
  catalog: readonly ClaudeRuntimeCatalogEntry[],
): ClaudeRuntimeCatalogEntry | null {
  return catalog.find((entry) => entry.isDefault) ?? catalog[0] ?? null;
}

/**
 * 按当前 profile catalog 解析 Claude managed runtime。
 *
 * 1. catalog 命中 entry → 用 entry.model（映射后的 runtime），不 repair
 * 2. 未命中但候选是 k3/kimi 残留 → repair 到 catalog default
 * 3. 未命中且非残留 → freeform 放行（与 allowUnknownActiveThreadModel 对齐）
 */
export function resolveClaudeManagedRuntimeModel(options: {
  entryId?: string | null;
  catalog: readonly ClaudeRuntimeCatalogEntry[];
  profileEnv?: Record<string, unknown> | null;
  fallbackRuntime?: string | null;
}): ResolveClaudeManagedRuntimeResult {
  const catalog = options.catalog;
  const legal = buildLegalClaudeRuntimes(catalog, options.profileEnv);
  const entryId = options.entryId?.trim() || null;
  const fallback = options.fallbackRuntime?.trim() || null;
  const candidate = entryId || fallback;

  const matched = entryId
    ? (catalog.find((entry) => entry.id === entryId) ?? null)
    : null;

  if (matched) {
    const runtime = matched.model?.trim() || matched.id.trim() || null;
    return { runtime, entryId: matched.id, repaired: false };
  }

  // 按 runtime 反查 catalog（selection 存的是 model 字符串而非 id）
  if (fallback) {
    const byRuntime = catalog.find(
      (entry) => (entry.model?.trim() || entry.id.trim()) === fallback,
    );
    if (byRuntime) {
      const runtime = byRuntime.model?.trim() || byRuntime.id.trim() || null;
      return { runtime, entryId: byRuntime.id, repaired: false };
    }
  }

  const isUnlistedResidue = (value: string | null): boolean =>
    Boolean(
      value &&
        isForeignClaudeRuntimeResidue(value) &&
        !legal.has(value),
    );

  // 跨供应商残留：catalog 已就绪时 repair（entry 或 fallback 任一命中）
  if (
    catalog.length > 0 &&
    (isUnlistedResidue(entryId) || isUnlistedResidue(fallback))
  ) {
    const defaultEntry = pickDefaultEntry(catalog);
    if (defaultEntry) {
      return {
        runtime: defaultEntry.model?.trim() || defaultEntry.id.trim() || null,
        entryId: defaultEntry.id,
        repaired: true,
      };
    }
  }

  // freeform / 合法自定义：不得用「非残留 entryId + 残留 fallback」拼出脏 runtime
  if (entryId && !isForeignClaudeRuntimeResidue(entryId)) {
    return { runtime: entryId, entryId, repaired: false };
  }
  if (fallback && !isForeignClaudeRuntimeResidue(fallback)) {
    return { runtime: fallback, entryId: entryId || fallback, repaired: false };
  }

  // catalog 空窗：尽量 env 默认；否则放行 candidate freeform。
  // 无 catalog 时无法证明「跨供应商 residual」——产品名启发式不得误杀
  // MiniMax 等合法会话在 catalog 尚未就绪时的 selection（#catalog-unavailable）。
  if (catalog.length === 0) {
    const envMain =
      typeof options.profileEnv?.ANTHROPIC_MODEL === "string"
        ? options.profileEnv.ANTHROPIC_MODEL.trim()
        : "";
    if (envMain) {
      return {
        runtime: envMain,
        entryId: envMain,
        repaired: Boolean(
          (entryId && isForeignClaudeRuntimeResidue(entryId)) ||
            (fallback && isForeignClaudeRuntimeResidue(fallback)),
        ),
      };
    }
    if (candidate) {
      return { runtime: candidate, entryId: candidate, repaired: false };
    }
  }

  return {
    runtime: null,
    entryId: null,
    repaired: Boolean(
      (entryId && isForeignClaudeRuntimeResidue(entryId)) ||
        (fallback && isForeignClaudeRuntimeResidue(fallback)),
    ),
  };
}
