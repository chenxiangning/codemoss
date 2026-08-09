// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CodexProviderConfig } from "../types";
import {
  buildCodexProviderReorderIds,
  CodexProviderList,
  extractCodexTomlModel,
} from "./CodexProviderList";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function provider(
  id: string,
  options: Partial<CodexProviderConfig> = {},
): CodexProviderConfig {
  return {
    id,
    name: `Provider ${id.toUpperCase()}`,
    authJson: "{}",
    configToml: "",
    ...options,
  };
}

function renderList(
  providers: CodexProviderConfig[],
  overrides: Partial<Parameters<typeof CodexProviderList>[0]> = {},
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
  const view = render(<CodexProviderList {...props} />);
  return { ...view, props };
}

describe("buildCodexProviderReorderIds", () => {
  it("moves the dragged provider to the destination index", () => {
    const providers = [provider("a"), provider("b"), provider("c")];

    expect(buildCodexProviderReorderIds(providers, 0, 2)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

describe("extractCodexTomlModel", () => {
  it("extracts the model line from config.toml text", () => {
    expect(
      extractCodexTomlModel('model = "gpt-5.1-codex"\nwire_api = "responses"'),
    ).toBe("gpt-5.1-codex");
  });

  it("returns null when no model is present", () => {
    expect(extractCodexTomlModel('base_url = "https://example.com"')).toBeNull();
    expect(extractCodexTomlModel(undefined)).toBeNull();
  });
});

describe("CodexProviderList", () => {
  it("renders provider cards with drag handles under the all-providers title", () => {
    const { container } = renderList([
      provider("a"),
      provider("b", { isActive: true }),
    ]);

    expect(container.querySelector(".vendor-list-title")?.textContent).toBe(
      "settings.vendor.providerChannels",
    );
    expect(
      container.querySelectorAll("[title='settings.vendor.dragToReorder']"),
    ).toHaveLength(2);
    expect(container.querySelectorAll(".vendor-card.active")).toHaveLength(1);
    expect(
      Array.from(container.querySelectorAll(".vendor-card-name")).map(
        (element) => element.textContent,
      ),
    ).toEqual(["ProviderA", "ProviderB"]);
  });

  it("switches a provider on via its active switch", () => {
    const { props } = renderList([
      provider("a"),
      provider("b", { isActive: true }),
    ]);

    fireEvent.click(
      screen.getByRole("switch", { name: /settings\.vendor\.enable: Provider A/ }),
    );

    expect(props.onSwitch).toHaveBeenCalledWith("a");
    expect(
      screen
        .getByRole("switch", { name: /settings\.vendor\.inUse: Provider B/ })
        .getAttribute("data-state"),
    ).toBe("checked");
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

  it("renders header actions next to the add button", () => {
    renderList([], {
      headerActions: (
        <button type="button">settings.vendor.pluginModels</button>
      ),
    });

    expect(
      screen.getByRole("button", { name: "settings.vendor.pluginModels" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /settings\.vendor\.add/ }),
    ).toBeTruthy();
  });

  it("shows the empty state when no providers exist", () => {
    renderList([]);

    expect(screen.getByText("settings.vendor.emptyCodexState")).toBeTruthy();
  });
});
