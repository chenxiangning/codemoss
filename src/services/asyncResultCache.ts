/**
 * Small TTL + in-flight cache for expensive IPC/CLI list commands.
 * Timeout / cancelled loads should not write success entries (caller controls).
 */

export type AsyncResultCacheOptions = {
  ttlMs: number;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

function nowMs(): number {
  return Date.now();
}

export function createAsyncResultCache<T>(options: AsyncResultCacheOptions) {
  const ttlMs = Math.max(0, options.ttlMs);
  const entries = new Map<string, CacheEntry<T>>();
  const inflight = new Map<string, Promise<T>>();

  function get(key: string): T | undefined {
    const entry = entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (nowMs() >= entry.expiresAt) {
      entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key: string, value: T): void {
    if (ttlMs <= 0) {
      return;
    }
    entries.set(key, {
      value,
      expiresAt: nowMs() + ttlMs,
    });
  }

  function invalidate(key: string): void {
    entries.delete(key);
  }

  function clear(): void {
    entries.clear();
    inflight.clear();
  }

  /**
   * Return cached value, join in-flight load, or run loader.
   * Loader result is cached only when `cacheResult` returns true (default true).
   */
  async function getOrLoad(
    key: string,
    loader: () => Promise<T>,
    opts?: {
      bypassCache?: boolean;
      cacheResult?: (value: T) => boolean;
    },
  ): Promise<T> {
    if (!opts?.bypassCache) {
      const hit = get(key);
      if (hit !== undefined) {
        return hit;
      }
    }

    const existing = inflight.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const value = await loader();
        const shouldCache = opts?.cacheResult ? opts.cacheResult(value) : true;
        if (shouldCache) {
          set(key, value);
        }
        return value;
      } finally {
        inflight.delete(key);
      }
    })();

    inflight.set(key, promise);
    return promise;
  }

  return {
    get,
    set,
    invalidate,
    clear,
    getOrLoad,
  };
}
