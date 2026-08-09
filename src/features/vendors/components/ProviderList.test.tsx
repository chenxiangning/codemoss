// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProviderConfig } from "../types";
import { LOCAL_SETTINGS_PROVIDER_ID } from "../types";
import { buildClaudeProviderReorderIds, ProviderList } from "./ProviderList";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function provider(
  id: string,
  options: Partial<ProviderConfig> = {},
): ProviderConfig {
  return {
    id,
    name: `Provider ${id.toUpperCase()}`,
    ...options,
  };
}

function renderList(
  providers: ProviderConfig[],
  overrides: Partial<Parameters<typeof ProviderList>[0]> = {},
) {
  const props = {
    providers,
    loading: false,
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
    onSwitch: vi.fn(),
    ...overrides,
  };
  const view = render(<ProviderList {...props} />);
  return { ...view, props };
}

describe("buildClaudeProviderReorderIds", () => {
  it("reorders every managed provider without active-provider pinning", () => {
    const providers = [
      provider("a"),
      provider("b", { isActive: true }),
      provider("c"),
    ];

    expect(buildClaudeProviderReorderIds(providers, 1, 0)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("reorders all regular providers when no active provider exists", () => {
    const providers = [provider("a"), provider("b"), provider("c")];

    expect(buildClaudeProviderReorderIds(providers, 0, 2)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

describe("ProviderList", () => {
  it("renders only regular providers; the local settings entry is not a card", () => {
    const { container } = renderList([
      provider(LOCAL_SETTINGS_PROVIDER_ID, {
        isActive: false,
        isLocalProvider: true,
      }),
      provider("a"),
      provider("b", { isActive: true }),
      provider("c"),
    ]);

    const cardNames = Array.from(
      container.querySelectorAll(".vendor-card-name"),
    ).map((element) => element.textContent);

    expect(cardNames).toEqual(["ProviderA", "ProviderB", "ProviderC"]);
    expect(
      container.querySelector(".vendor-list-title")?.textContent,
    ).toBe("settings.vendor.providerChannels");
    expect(
      container.querySelectorAll("[title='settings.vendor.dragToReorder']"),
    ).toHaveLength(3);
    expect(container.querySelectorAll(".vendor-card.active")).toHaveLength(1);
  });

  it("switches a provider on via its active switch", () => {
    const providerA = provider("a");
    const { props } = renderList([providerA, provider("b", { isActive: true })]);

    fireEvent.click(
      screen.getByRole("switch", { name: /settings\.vendor\.enable: Provider A/ }),
    );

    expect(props.onSwitch).toHaveBeenCalledWith("a");
    expect(
      screen
        .getByRole("switch", { name: /settings\.vendor\.inUse: Provider B/ })
        .getAttribute("data-state"),
    ).toBe("checked");
    expect(
      screen.getAllByRole("switch", { name: /settings\.vendor\.enable/ }),
    ).toHaveLength(1);
  });

  it("deactivates the active provider via its switch", () => {
    const { props } = renderList([provider("b", { isActive: true })]);

    fireEvent.click(
      screen.getByRole("switch", { name: /settings\.vendor\.inUse: Provider B/ }),
    );

    expect(props.onSwitch).toHaveBeenCalledWith("__disabled__");
  });

  it("wires edit and delete actions on cards", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const providerA = provider("a");

    renderList([providerA], { onEdit, onDelete });

    fireEvent.click(screen.getByTitle("settings.vendor.edit"));
    fireEvent.click(screen.getByTitle("settings.vendor.delete"));

    expect(onEdit).toHaveBeenCalledWith(providerA);
    expect(onDelete).toHaveBeenCalledWith(providerA);
  });

  it("renders provider name suffix as secondary text", () => {
    const { container } = renderList([provider("a", { name: "midsummer 自用1" })]);

    expect(container.querySelector(".vendor-card-name")?.textContent).toBe(
      "midsummer自用1",
    );
    expect(
      container.querySelector(".vendor-card-name-extension")?.textContent,
    ).toBe("自用1");
  });

  it("renders header actions next to the add button", () => {
    renderList([], {
      headerActions: <button type="button">settings.vendor.pluginModels</button>,
    });

    expect(
      screen.getByRole("button", { name: "settings.vendor.pluginModels" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /settings\.vendor\.add/ }),
    ).toBeTruthy();
  });
});
