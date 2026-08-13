/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

vi.mock("../../../services/dragDrop", () => ({
  subscribeWindowDragDrop: vi.fn(() => () => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `tauri://${path}`,
  invoke: vi.fn(async () => null),
}));

vi.mock("../../engine/components/EngineSelector", () => ({
  EngineSelector: () => null,
}));


vi.mock("./ChatInputBox/ChatInputBoxAdapter", () => ({
  ChatInputBoxAdapter: ({
    text,
    onTextChange,
    onSend,
    memoryReferenceMode = "off",
    onSetMemoryReferenceMode,
  }: {
    text: string;
    onTextChange: (next: string, cursor: number | null) => void;
    onSend: () => void;
    memoryReferenceMode?: "off" | "pick" | "always" | "single";
    onSetMemoryReferenceMode?: (
      mode: "off" | "pick" | "always" | "single",
    ) => void;
  }) => (
    <div>
      <button
        type="button"
        aria-pressed={memoryReferenceMode !== "off"}
        aria-label="composer.memoryReferenceToggle"
        onClick={() =>
          onSetMemoryReferenceMode?.(
            memoryReferenceMode === "off" ? "pick" : "off",
          )
        }
      >
        {memoryReferenceMode === "always"
          ? "composer.memoryReferenceAlwaysOn"
          : memoryReferenceMode === "pick" || memoryReferenceMode === "single"
            ? "composer.memoryReferencePickOn"
            : "composer.memoryReferenceOff"}
      </button>
      <button
        type="button"
        data-testid="enable-always-memory"
        onClick={() => onSetMemoryReferenceMode?.("always")}
      >
        composer.memoryReferenceEnableAlways
      </button>
      <span data-testid="memory-reference-mode">
        {memoryReferenceMode === "always"
          ? "always"
          : memoryReferenceMode === "pick" || memoryReferenceMode === "single"
            ? "pick"
            : "composer.memoryReferenceOff"}
      </span>
      <textarea
        aria-label="chat draft"
        value={text}
        onChange={(event) =>
          onTextChange(event.currentTarget.value, event.currentTarget.value.length)
        }
      />
      <button type="button" data-testid="send-message" onClick={() => onSend()}>
        send
      </button>
    </div>
  ),
}));

function renderComposer(onSend = vi.fn(() => Promise.resolve())) {
  return render(
    <Composer
      onSend={onSend}
      onQueue={() => {}}
      onStop={() => {}}
      canStop={false}
      isProcessing={false}
      steerEnabled={false}
      collaborationModes={[]}
      collaborationModesEnabled={true}
      selectedCollaborationModeId={null}
      onSelectCollaborationMode={() => {}}
      selectedEngine="claude"
      models={[]}
      selectedModelId={null}
      onSelectModel={() => {}}
      reasoningOptions={[]}
      selectedEffort={null}
      onSelectEffort={() => {}}
      reasoningSupported={false}
      accessMode="current"
      onSelectAccessMode={() => {}}
      skills={[]}
      prompts={[]}
      commands={[]}
      files={[]}
      onDraftChange={() => {}}
      dictationEnabled={false}
      activeWorkspaceId="ws-1"
      activeThreadId="thread-1"
    />,
  );
}

describe("Composer Memory Reference toggle", () => {
  afterEach(() => {
    cleanup();
  });

  it("defaults off, toggles pick-this-turn reference and keeps after send", async () => {
    const onSend = vi.fn(() => Promise.resolve());
    renderComposer(onSend);

    const toggle = screen.getByRole("button", { name: "composer.memoryReferenceToggle" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.textContent).toBe("composer.memoryReferenceOff");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("composer.memoryReferencePickOn")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("chat draft"), {
      target: { value: "hello memory" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("send-message"));
      await Promise.resolve();
    });

    expect(onSend).toHaveBeenCalledWith(
      "hello memory",
      [],
      expect.objectContaining({ memoryReferenceMode: "pick" }),
    );
    // pick 偏好保留，不再像旧 single 发完即关
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps always-on memory reference after send", async () => {
    const onSend = vi.fn(() => Promise.resolve());
    renderComposer(onSend);

    fireEvent.click(screen.getByTestId("enable-always-memory"));
    expect(screen.getByTestId("memory-reference-mode").textContent).toBe("always");

    fireEvent.change(screen.getByLabelText("chat draft"), {
      target: { value: "first always memory" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("send-message"));
      await Promise.resolve();
    });

    expect(onSend).toHaveBeenCalledWith(
      "first always memory",
      [],
      expect.objectContaining({ memoryReferenceEnabled: true }),
    );
    expect(screen.getByTestId("memory-reference-mode").textContent).toBe("always");

    fireEvent.change(screen.getByLabelText("chat draft"), {
      target: { value: "second always memory" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("send-message"));
      await Promise.resolve();
    });

    expect(onSend).toHaveBeenLastCalledWith(
      "second always memory",
      [],
      expect.objectContaining({ memoryReferenceEnabled: true }),
    );
    expect(screen.getByTestId("memory-reference-mode").textContent).toBe("always");
  });
});
