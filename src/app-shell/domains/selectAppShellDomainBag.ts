import {
  flattenSelectedAppShellDomainContextsMemoized,
  type AppShellDomainContextName,
  type AppShellDomainContextSelection,
  type AppShellDomainContexts,
  type DomainFlattenIdentityCache,
} from "./appShellDomainContexts";

/**
 * T4：正式 domain bag 选择 API（生产路径应使用本模块，而非 legacy flatten 命名）。
 *
 * - 只合并 `domainNames` 列出的 domain 切片
 * - 配合 DomainFlattenIdentityCache：未变 domain 引用时复用同一 bag 对象
 */

export type AppShellDomainBag = Record<string, unknown>;

export function createDomainFlattenCache(): DomainFlattenIdentityCache {
  return { domainValues: null, flattened: null };
}

export function selectAppShellDomainBag<
  TDomainName extends AppShellDomainContextName,
>(
  contexts: AppShellDomainContextSelection<TDomainName> | AppShellDomainContexts,
  domainNames: readonly TDomainName[],
  cache: DomainFlattenIdentityCache,
): AppShellDomainBag {
  return flattenSelectedAppShellDomainContextsMemoized(
    contexts,
    domainNames,
    cache,
  );
}

/** 将 selected bag 绑定为 consumer 边界类型（类型断言，无运行时开销）。 */
export function bindAppShellDomainBag<TBoundary extends object>(
  bag: AppShellDomainBag,
): TBoundary {
  return bag as TBoundary;
}

/**
 * 合并 selected domain bag 与额外 section 输出（search/sections/layoutNodes）。
 */
export function mergeAppShellDomainBag<TBoundary extends object>(
  domainBag: AppShellDomainBag,
  ...extras: Array<Record<string, unknown>>
): TBoundary {
  return Object.assign({}, domainBag, ...extras) as TBoundary;
}
