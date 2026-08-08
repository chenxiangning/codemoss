// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateCodexProvider = vi.fn();
const updateClaudeProvider = vi.fn();

vi.mock("../../services/tauri", () => ({
  updateCodexProvider: (...args: unknown[]) => updateCodexProvider(...args),
  updateClaudeProvider: (...args: unknown[]) => updateClaudeProvider(...args),
}));

vi.mock(
  "../composer/components/ChatInputBox/hooks/useProviderTargetCatalogOwners",
  () => ({
    notifyProviderTargetCatalogChanged: vi.fn(),
  }),
);

import {
  flushCustomModelPersistQueuesForTests,
  persistClaudeCustomModelCatalog,
  persistCodexCustomModelCatalog,
} from "./persistCustomModelCatalog";

describe("persistCustomModelCatalog", () => {
  beforeEach(() => {
    updateCodexProvider.mockReset();
    updateClaudeProvider.mockReset();
    updateCodexProvider.mockResolvedValue(undefined);
    updateClaudeProvider.mockResolvedValue(undefined);
  });

  it("serializes concurrent Codex writes so later full list wins", async () => {
    let resolveFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    updateCodexProvider.mockImplementationOnce(async () => {
      await firstGate;
    });
    updateCodexProvider.mockImplementationOnce(async () => undefined);

    const providers = [
      {
        id: "provider-a",
        name: "A",
        isActive: true,
        customModels: [] as Array<{ id: string; label: string }>,
      },
    ];

    const first = persistCodexCustomModelCatalog(
      [{ id: "m1", label: "M1", providerProfileId: "provider-a" }],
      providers,
    );
    const second = persistCodexCustomModelCatalog(
      [
        { id: "m1", label: "M1", providerProfileId: "provider-a" },
        { id: "m2", label: "M2", providerProfileId: "provider-a" },
      ],
      providers,
    );

    resolveFirst?.();
    await Promise.all([first, second]);
    await flushCustomModelPersistQueuesForTests();

    expect(updateCodexProvider).toHaveBeenCalledTimes(2);
    const lastCall = updateCodexProvider.mock.calls.at(-1);
    expect(lastCall?.[1].customModels).toEqual([
      { id: "m1", label: "M1" },
      { id: "m2", label: "M2" },
    ]);
  });

  it("surfaces provider update failures", async () => {
    updateClaudeProvider.mockRejectedValueOnce(new Error("network down"));
    await expect(
      persistClaudeCustomModelCatalog(
        [{ id: "m1", label: "M1", providerProfileId: "provider-b" }],
        [
          {
            id: "provider-b",
            name: "B",
            isActive: true,
            customModels: [],
          },
        ],
      ),
    ).rejects.toThrow(/network down|Failed to sync Claude/);
  });

  it("never patches Claude local settings provider", async () => {
    await persistClaudeCustomModelCatalog(
      [
        {
          id: "m1",
          label: "M1",
          providerProfileId: "__local_settings_json__",
        },
      ],
      [
        {
          id: "__local_settings_json__",
          name: "Local",
          isLocalProvider: true,
          customModels: [],
        },
      ],
    );
    expect(updateClaudeProvider).not.toHaveBeenCalled();
  });
});
