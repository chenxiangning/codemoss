/**
 * T4.5：Legacy flatten / adapt 适配器门面（明示 legacy）。
 *
 * 生产路径请改用 `domains/selectAppShellDomainBag.ts`：
 * - selectAppShellDomainBag
 * - bindAppShellDomainBag
 * - mergeAppShellDomainBag
 *
 * 本文件 re-export 旧名称，供测试与过渡代码使用。
 */

export {
  /** @deprecated 使用 selectAppShellDomainBag + 全量 domain 列表（不推荐） */
  flattenAppShellDomainContexts,
  /** @deprecated 使用 selectAppShellDomainBag */
  flattenSelectedAppShellDomainContexts,
  /** @deprecated 使用 selectAppShellDomainBag(..., cache) */
  flattenSelectedAppShellDomainContextsMemoized,
  /** @deprecated 使用 bindAppShellDomainBag */
  adaptAppShellLegacyFlatContext,
  type AppShellLegacyFlatContext,
  type DomainFlattenIdentityCache,
} from "../domains/appShellDomainContexts";
