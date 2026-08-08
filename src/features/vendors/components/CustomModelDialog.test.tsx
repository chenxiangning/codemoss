// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomModelDialog } from "./CustomModelDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("CustomModelDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps Claude custom model ids as user-entered facts in shape-only mode", () => {
    const onModelsChange = vi.fn();

    render(
      <CustomModelDialog
        isOpen
        initialAddMode
        modelValidation="shape-only"
        models={[]}
        onModelsChange={onModelsChange}
        onClose={vi.fn()}
        providerOptions={[
          { id: "", name: "settings.vendor.modelManager.localProvider" },
          { id: "provider-a", name: "Provider A" },
        ]}
        defaultProviderProfileId="provider-a"
      />,
    );

    expect(
      (screen.getByTestId("custom-model-provider-select") as HTMLSelectElement)
        .value,
    ).toBe("provider-a");

    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.modelManager.modelIdPlaceholder"),
      { target: { value: "  Haiku  4.5  " } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.modelManager.modelLabelPlaceholder"),
      { target: { value: "  Haiku  4.5  " } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.vendor.modelManager.addModel",
      }),
    );

    expect(onModelsChange).toHaveBeenCalledWith([
      {
        id: "Haiku  4.5",
        label: "Haiku  4.5",
        description: undefined,
        providerProfileId: "provider-a",
      },
    ]);
  });

  it("saves local-only models without providerProfileId", () => {
    const onModelsChange = vi.fn();

    render(
      <CustomModelDialog
        isOpen
        initialAddMode
        modelValidation="model-id"
        models={[]}
        onModelsChange={onModelsChange}
        onClose={vi.fn()}
        providerOptions={[
          { id: "", name: "Local" },
          { id: "provider-a", name: "Provider A" },
        ]}
        defaultProviderProfileId=""
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.modelManager.modelIdPlaceholder"),
      { target: { value: "gpt-local-1" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.modelManager.modelLabelPlaceholder"),
      { target: { value: "Local GPT" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.vendor.modelManager.addModel",
      }),
    );

    expect(onModelsChange).toHaveBeenCalledWith([
      {
        id: "gpt-local-1",
        label: "Local GPT",
        description: undefined,
        providerProfileId: undefined,
      },
    ]);
  });

  it("keeps model-id validation for non-Claude custom model dialogs", () => {
    const onModelsChange = vi.fn();

    render(
      <CustomModelDialog
        isOpen
        initialAddMode
        modelValidation="model-id"
        models={[]}
        onModelsChange={onModelsChange}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.modelManager.modelIdPlaceholder"),
      { target: { value: "x".repeat(257) } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.vendor.modelManager.addModel",
      }),
    );

    expect(onModelsChange).not.toHaveBeenCalled();
    expect(screen.getByText("settings.vendor.modelManager.modelIdInvalid")).toBeTruthy();
  });

  it("places the add model action in the top-right toolbar above the model list", () => {
    render(
      <CustomModelDialog
        isOpen
        models={[]}
        onModelsChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const addButton = screen.getByRole("button", {
      name: "+ settings.vendor.modelManager.addModel",
    });
    const modelList = screen.getByRole("list");
    const toolbar = addButton.closest(".vendor-model-manager-toolbar");

    expect(toolbar).toBeTruthy();
    expect(toolbar?.contains(addButton)).toBe(true);
    expect(
      addButton.compareDocumentPosition(modelList) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("does not wipe typed model id when provider options load asynchronously", () => {
    const { rerender } = render(
      <CustomModelDialog
        isOpen
        initialAddMode
        modelValidation="model-id"
        models={[]}
        onModelsChange={vi.fn()}
        onClose={vi.fn()}
        providerOptions={[{ id: "", name: "Local" }]}
        defaultProviderProfileId=""
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.modelManager.modelIdPlaceholder"),
      { target: { value: "gpt-keep-me" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.modelManager.modelLabelPlaceholder"),
      { target: { value: "Keep Me" } },
    );

    rerender(
      <CustomModelDialog
        isOpen
        initialAddMode
        modelValidation="model-id"
        models={[]}
        onModelsChange={vi.fn()}
        onClose={vi.fn()}
        providerOptions={[
          { id: "", name: "Local" },
          { id: "provider-a", name: "Provider A" },
        ]}
        defaultProviderProfileId="provider-a"
      />,
    );

    expect(
      (
        screen.getByPlaceholderText(
          "settings.vendor.modelManager.modelIdPlaceholder",
        ) as HTMLInputElement
      ).value,
    ).toBe("gpt-keep-me");
    expect(
      (
        screen.getByPlaceholderText(
          "settings.vendor.modelManager.modelLabelPlaceholder",
        ) as HTMLInputElement
      ).value,
    ).toBe("Keep Me");
    // Soft-default may promote to active/preferred provider without clearing fields.
    expect(
      (screen.getByTestId("custom-model-provider-select") as HTMLSelectElement)
        .value,
    ).toBe("provider-a");
  });

  it("does not override provider after user manually changes it when options refresh", () => {
    const { rerender } = render(
      <CustomModelDialog
        isOpen
        initialAddMode
        models={[]}
        onModelsChange={vi.fn()}
        onClose={vi.fn()}
        providerOptions={[
          { id: "", name: "Local" },
          { id: "provider-a", name: "Provider A" },
          { id: "provider-b", name: "Provider B" },
        ]}
        defaultProviderProfileId="provider-a"
      />,
    );

    fireEvent.change(screen.getByTestId("custom-model-provider-select"), {
      target: { value: "provider-b" },
    });

    rerender(
      <CustomModelDialog
        isOpen
        initialAddMode
        models={[]}
        onModelsChange={vi.fn()}
        onClose={vi.fn()}
        providerOptions={[
          { id: "", name: "Local" },
          { id: "provider-a", name: "Provider A" },
          { id: "provider-b", name: "Provider B" },
        ]}
        defaultProviderProfileId="provider-a"
      />,
    );

    expect(
      (screen.getByTestId("custom-model-provider-select") as HTMLSelectElement)
        .value,
    ).toBe("provider-b");
  });
});
