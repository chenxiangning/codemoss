import { describe, expect, it } from "vitest";
import {
  LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID,
  buildManagedProviderOptions,
  buildProviderCustomModelsPatches,
  providerCustomModelsEqual,
  resolveDefaultProviderOptionId,
  toProviderStoredCustomModel,
} from "./customModelProviderBinding";

describe("customModelProviderBinding", () => {
  it("strips providerProfileId for provider store payloads", () => {
    expect(
      toProviderStoredCustomModel({
        id: " m1 ",
        label: " Model 1 ",
        description: " d ",
        providerProfileId: "provider-a",
      }),
    ).toEqual({
      id: "m1",
      label: "Model 1",
      description: "d",
    });
  });

  it("builds patches only for providers whose customModels changed", () => {
    const providers = [
      {
        id: "provider-a",
        customModels: [{ id: "old", label: "Old" }],
      },
      {
        id: "provider-b",
        customModels: [{ id: "keep", label: "Keep" }],
      },
    ];
    const next = [
      {
        id: "new",
        label: "New",
        providerProfileId: "provider-a",
      },
      {
        id: "keep",
        label: "Keep",
        providerProfileId: "provider-b",
      },
      {
        id: "local-only",
        label: "Local",
      },
    ];

    const patches = buildProviderCustomModelsPatches(providers, next);
    expect(patches).toEqual([
      {
        providerId: "provider-a",
        customModels: [{ id: "new", label: "New" }],
      },
    ]);
  });

  it("does not write local-only models into managed provider patches", () => {
    const patches = buildProviderCustomModelsPatches(
      [{ id: "provider-a", customModels: [] }],
      [{ id: "local", label: "Local" }],
    );
    expect(patches).toEqual([]);
  });

  it("treats equal custom model sets as equal regardless of order", () => {
    expect(
      providerCustomModelsEqual(
        [
          { id: "b", label: "B" },
          { id: "a", label: "A" },
        ],
        [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
      ),
    ).toBe(true);
  });

  it("resolves default provider: preferred > active > local", () => {
    const options = [
      { id: LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID, name: "Local" },
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];
    expect(resolveDefaultProviderOptionId(options, "b", "a")).toBe("b");
    expect(resolveDefaultProviderOptionId(options, null, "a")).toBe("a");
    expect(resolveDefaultProviderOptionId(options, "missing", null)).toBe(
      LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID,
    );
  });

  it("builds managed options with local first and skips local providers", () => {
    const options = buildManagedProviderOptions(
      [
        { id: "__local_settings_json__", name: "Local", isLocalProvider: true },
        { id: "xmapi", name: "xmapi.cc" },
      ],
      "本地配置",
      ["__local_settings_json__"],
    );
    expect(options[0]).toEqual({
      id: LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID,
      name: "本地配置",
    });
    expect(options.map((item) => item.id)).toEqual([
      LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID,
      "xmapi",
    ]);
  });
});
