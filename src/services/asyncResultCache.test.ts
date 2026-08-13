import { describe, expect, it, vi } from "vitest";
import { createAsyncResultCache } from "./asyncResultCache";

describe("createAsyncResultCache", () => {
  it("returns cached value within TTL", async () => {
    const cache = createAsyncResultCache<number>({ ttlMs: 60_000 });
    const loader = vi.fn().mockResolvedValue(42);
    await expect(cache.getOrLoad("k", loader)).resolves.toBe(42);
    await expect(cache.getOrLoad("k", loader)).resolves.toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("joins concurrent loaders", async () => {
    const cache = createAsyncResultCache<number>({ ttlMs: 60_000 });
    let resolveLoader: ((value: number) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    const a = cache.getOrLoad("k", loader);
    const b = cache.getOrLoad("k", loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(resolveLoader).toBeTypeOf("function");
    resolveLoader!(7);
    await expect(a).resolves.toBe(7);
    await expect(b).resolves.toBe(7);
  });

  it("skips caching when cacheResult returns false", async () => {
    const cache = createAsyncResultCache<number>({ ttlMs: 60_000 });
    const loader = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    await expect(
      cache.getOrLoad("k", loader, { cacheResult: () => false }),
    ).resolves.toBe(1);
    await expect(cache.getOrLoad("k", loader)).resolves.toBe(2);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
