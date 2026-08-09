import { DISABLED_PROVIDER_ID } from "./types";

/** Provider rows that expose exclusive `isActive` for channel switch UI. */
export type WithActiveFlag = {
  id: string;
  isActive?: boolean;
};

/**
 * Apply exclusive activation optimistically.
 * - `activeId === DISABLED_PROVIDER_ID` → all channels inactive
 * - otherwise only `activeId` is active
 * Unchanged rows keep their object identity to reduce list re-renders.
 */
export function applyOptimisticActiveProvider<T extends WithActiveFlag>(
  providers: readonly T[],
  activeId: string,
): T[] {
  const disableAll = activeId === DISABLED_PROVIDER_ID;
  return providers.map((provider) => {
    const nextActive = disableAll ? false : provider.id === activeId;
    // Strict equality so `undefined` is normalized to explicit `false`.
    if (provider.isActive === nextActive) {
      return provider;
    }
    return { ...provider, isActive: nextActive };
  });
}
