// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchSharedSendEvent,
  getSharedSendState,
  resetSharedSendStateStoreForTests,
} from "../runtime/sharedSendStateStore";
import { resetSharedSessionAttemptReattachmentsForTests } from "../runtime/reattachSharedSessionAttempt";
import {
  resetSharedTargetStoreForTests,
} from "../target/targetStore";
import { SharedSendStatusBar } from "./SharedSendStatusBar";

const mockServices = vi.hoisted(() => ({
  pushErrorToast: vi.fn(),
  sharedSessionV2TurnState: vi.fn(),
  sharedSessionV2ProbeBinding: vi.fn(),
  sharedSessionV2RecoverAttempt: vi.fn(),
  sharedSessionV2RebuildBinding: vi.fn(),
  sharedSessionV2InterruptTurn: vi.fn(),
  sharedSessionV2AbandonUnresolvedAttempt: vi.fn(),
  sharedSessionV2AwaitTurnTerminal: vi.fn(),
  registerSharedSessionNativeBinding: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const values = Object.values(params ?? {});
      return values.length ? `${key}:${values.join(":")}` : key;
    },
  }),
}));

vi.mock("../runtime/sharedV2SendFlag", () => ({
  isSharedV2SendEnabled: () => true,
}));

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: mockServices.pushErrorToast,
}));

vi.mock("../services/sharedSessions", () => ({
  sharedSessionV2TurnState: mockServices.sharedSessionV2TurnState,
  sharedSessionV2ProbeBinding: mockServices.sharedSessionV2ProbeBinding,
  sharedSessionV2RecoverAttempt: mockServices.sharedSessionV2RecoverAttempt,
  sharedSessionV2RebuildBinding: mockServices.sharedSessionV2RebuildBinding,
  sharedSessionV2InterruptTurn: mockServices.sharedSessionV2InterruptTurn,
  sharedSessionV2AbandonUnresolvedAttempt:
    mockServices.sharedSessionV2AbandonUnresolvedAttempt,
  sharedSessionV2AwaitTurnTerminal:
    mockServices.sharedSessionV2AwaitTurnTerminal,
}));

vi.mock("../runtime/sharedRecoveryExitFlag", () => ({
  isSharedRecoveryExitV2Enabled: () => true,
}));

vi.mock("../runtime/sharedSessionBridge", () => ({
  registerSharedSessionNativeBinding:
    mockServices.registerSharedSessionNativeBinding,
}));

vi.mock("../../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onCancel,
    title,
  }: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
  }) =>
    open ? (
      <div data-testid="skip-confirm-dialog">
        <span>{title}</span>
        <button type="button" onClick={onConfirm}>
          confirm-skip
        </button>
        <button type="button" onClick={onCancel}>
          cancel-skip
        </button>
      </div>
    ) : null,
}));

vi.mock("../../../components/ui/alert-dialog", () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: ReactNode;
  }) => (open ? <div data-testid="details-dialog">{children}</div> : null),
  AlertDialogPopup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const WS = "ws-1";
const THREAD = "shared-thread-1";

function renderBar() {
  return render(
    <SharedSendStatusBar workspaceId={WS} threadId={THREAD} isSharedSession />,
  );
}

function enterRecovery() {
  dispatchSharedSendEvent(WS, THREAD, { type: "send" });
  dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
  dispatchSharedSendEvent(WS, THREAD, { type: "ackAmbiguous" });
}

beforeEach(() => {
  resetSharedSendStateStoreForTests();
  resetSharedTargetStoreForTests();
  resetSharedSessionAttemptReattachmentsForTests();
  mockServices.pushErrorToast.mockReset();
  mockServices.sharedSessionV2TurnState.mockReset();
  mockServices.sharedSessionV2ProbeBinding.mockReset();
  mockServices.sharedSessionV2RecoverAttempt.mockReset();
  mockServices.sharedSessionV2RebuildBinding.mockReset();
  mockServices.sharedSessionV2InterruptTurn.mockReset();
  mockServices.sharedSessionV2AbandonUnresolvedAttempt.mockReset();
  mockServices.sharedSessionV2AwaitTurnTerminal.mockReset();
  mockServices.registerSharedSessionNativeBinding.mockReset();
  mockServices.registerSharedSessionNativeBinding.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
});

describe("SharedSendStatusBar", () => {
  it("idle 状态不渲染", () => {
    const { container } = renderBar();
    expect(container.firstChild).toBeNull();
  });

  it("V2 flag 关闭时不渲染", async () => {
    const flag = await import("../runtime/sharedV2SendFlag");
    const spy = vi.spyOn(flag, "isSharedV2SendEnabled").mockReturnValue(false);
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    const { container } = renderBar();
    expect(container.firstChild).toBeNull();
    spy.mockRestore();
  });

  it("degraded-context 不渲染继续或取消确认", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, {
      type: "lossyProjection",
    }, {
      degradedInfo: { reason: "omissions: 2 files" },
    });
    const { container } = renderBar();

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("sharedSend.degradedConfirm")).toBeNull();
    expect(screen.queryByText("sharedSend.cancel")).toBeNull();
  });

  it("awaiting-acceptance 的 Cancel 在 capability 不支持时禁用", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    renderBar();
    const cancelButton = screen.getByText("sharedSend.cancel");
    expect((cancelButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(cancelButton);
    expect(getSharedSendState(WS, THREAD).state).toBe("awaiting-acceptance");
  });

  it("target-unavailable 展示原因", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "targetUnavailable" }, {
      detail: "provider removed",
    });
    renderBar();
    expect(screen.getByTestId("shared-send-status").textContent).toContain(
      "sharedSend.targetUnavailableReason:provider removed",
    );
  });

  it("recovery-required：默认露出自动处理与跳过，不平铺四按钮", () => {
    enterRecovery();
    renderBar();
    expect(screen.getByTestId("shared-send-recovery-auto")).toBeTruthy();
    expect(screen.getByTestId("shared-send-recovery-skip")).toBeTruthy();
    expect(screen.queryByText("sharedSend.recoveryProbe")).toBeNull();
    expect(screen.queryByText("sharedSend.recoveryStop")).toBeNull();
  });

  it("recovery-required：展开后显示高级动作", () => {
    enterRecovery();
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-expand"));
    expect(screen.getByTestId("shared-send-recovery-advanced")).toBeTruthy();
    expect(screen.getByText("sharedSend.recoveryProbe")).toBeTruthy();
    expect(screen.getByText("sharedSend.recoveryStop")).toBeTruthy();
    expect(screen.getByText("sharedSend.recoveryStopAndRebuild")).toBeTruthy();
  });

  it("recovery-required：详情 icon 打开应用内弹窗", () => {
    enterRecovery();
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-info"));
    expect(screen.getByTestId("details-dialog").textContent).toContain(
      "sharedSend.recoveryDetailsTitle",
    );
  });

  it("recovery-required：自动处理 clear owner 后解锁", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [],
    });
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-auto"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
  });

  it("recovery-required：自动处理 unknown 后 rebuild 解锁", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState
      .mockResolvedValueOnce({
        status: "ok",
        inFlightAttempts: [
          {
            attemptId: "attempt-1",
            bindingKey: "codex:prov-1",
            accepted: true,
          },
        ],
        bindings: [],
      })
      .mockResolvedValue({
        status: "ok",
        inFlightAttempts: [
          {
            attemptId: "attempt-1",
            bindingKey: "codex:prov-1",
            accepted: true,
          },
        ],
        bindings: [],
      });
    mockServices.sharedSessionV2RecoverAttempt.mockResolvedValue({
      status: "unknown",
      attemptId: "attempt-1",
    });
    mockServices.sharedSessionV2InterruptTurn.mockResolvedValue({
      status: "interrupted",
      attemptId: "attempt-1",
      engine: "codex",
      bindingKey: "codex:prov-1",
      nativeThreadId: "native-1",
      runtimeTurnId: "run-1",
    });
    mockServices.sharedSessionV2RebuildBinding.mockResolvedValue({
      status: "prepared",
      bindingKey: "codex:prov-1",
      nativeThreadId: "native-1",
    });
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-auto"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
    expect(mockServices.sharedSessionV2RecoverAttempt).toHaveBeenCalled();
    expect(mockServices.sharedSessionV2InterruptTurn).toHaveBeenCalled();
    expect(mockServices.sharedSessionV2RebuildBinding).toHaveBeenCalledWith(
      WS,
      THREAD,
      "codex:prov-1",
    );
  });

  it("recovery-required：自动处理失败保持锁定", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [
        {
          bindingKey: "codex:prov-1",
          provisioningState: "recovery-required",
          availability: "available",
        },
      ],
    });
    mockServices.sharedSessionV2RebuildBinding.mockRejectedValue(
      new Error(
        "recovery-active: attempt a1 is still owned by Runtime; Probe/Stop before rebuild",
      ),
    );
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-auto"));
    await waitFor(() => {
      expect(mockServices.pushErrorToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "sharedSend.recoveryAutoFailedTitle",
          message: "sharedSend.recoveryErrorActive",
        }),
      );
    });
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
    expect(screen.getByTestId("shared-send-status").textContent).toContain(
      "sharedSend.recoveryAutoFailedHint",
    );
    // 自动失败后「跳过」成为推荐下一步
    expect(
      screen.getByTestId("shared-send-recovery-skip").className,
    ).toContain("shared-send-status__button--recommend");
  });

  it("recovery-required：owner mismatch 映射成人话并引导跳过", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [
        {
          bindingKey: "squad:agent-x:plan:claude:default",
          provisioningState: "recovery-required",
          availability: "available",
        },
      ],
    });
    // 首次 squad key mismatch，durable 重试仍失败 → 引导跳过
    mockServices.sharedSessionV2RebuildBinding
      .mockRejectedValueOnce(
        new Error(
          "binding owner mismatch: key 'squad:agent-x:plan:claude:default' does not match durable owner 'claude:default'",
        ),
      )
      .mockRejectedValueOnce(
        new Error(
          "binding owner mismatch: key 'claude:default' does not match durable owner 'claude:default'",
        ),
      );
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-auto"));
    await waitFor(() => {
      expect(mockServices.pushErrorToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "sharedSend.recoveryAutoFailedTitle",
          message: "sharedSend.recoveryErrorOwnerMismatch",
        }),
      );
    });
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
    expect(mockServices.sharedSessionV2RebuildBinding).toHaveBeenCalledTimes(2);
    expect(mockServices.sharedSessionV2RebuildBinding).toHaveBeenNthCalledWith(
      2,
      WS,
      THREAD,
      "claude:default",
    );
  });

  it("recovery-required：换连接 owner mismatch 用重建专属文案并高亮跳过", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [
        {
          bindingKey: "codex:broken-key",
          provisioningState: "recovery-required",
          availability: "available",
        },
      ],
    });
    // 无可解析 durable 时不重试，直接映射换连接专属文案
    mockServices.sharedSessionV2RebuildBinding.mockRejectedValue(
      new Error("binding owner mismatch for attempt attempt-x"),
    );
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-expand"));
    fireEvent.click(screen.getByText("sharedSend.recoveryStopAndRebuild"));
    await waitFor(() => {
      expect(mockServices.pushErrorToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "sharedSend.recoveryRebuildFailedTitle",
          message: "sharedSend.recoveryErrorOwnerMismatchRebuild",
        }),
      );
    });
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
    expect(mockServices.sharedSessionV2RebuildBinding).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId("shared-send-recovery-skip").className,
    ).toContain("shared-send-status__button--recommend");
  });

  it("recovery-required：换连接 mismatch 后用 durable key 重试成功并解锁", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [
        {
          bindingKey: "squad:run-1:plan:claude:default",
          provisioningState: "recovery-required",
          availability: "available",
        },
      ],
    });
    mockServices.sharedSessionV2RebuildBinding
      .mockRejectedValueOnce(
        new Error(
          "binding owner mismatch: key 'squad:run-1:plan:claude:default' does not match durable owner 'claude:default'",
        ),
      )
      .mockResolvedValueOnce({
        status: "prepared",
        bindingKey: "claude:default",
      });
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-expand"));
    fireEvent.click(screen.getByText("sharedSend.recoveryStopAndRebuild"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
    expect(mockServices.sharedSessionV2RebuildBinding).toHaveBeenNthCalledWith(
      1,
      WS,
      THREAD,
      "squad:run-1:plan:claude:default",
    );
    expect(mockServices.sharedSessionV2RebuildBinding).toHaveBeenNthCalledWith(
      2,
      WS,
      THREAD,
      "claude:default",
    );
    expect(mockServices.pushErrorToast).not.toHaveBeenCalled();
  });

  async function expandAndWaitStopEnabled() {
    fireEvent.click(screen.getByTestId("shared-send-recovery-expand"));
    await waitFor(() => {
      const stopBtn = screen.getByText(
        "sharedSend.recoveryStop",
      ) as HTMLButtonElement;
      expect(stopBtn.disabled).toBe(false);
    });
  }

  it("recovery-required：停止请求成功后底条显示已请求停止", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [
        {
          attemptId: "attempt-stop",
          bindingKey: "codex:prov-1",
          accepted: true,
        },
      ],
      bindings: [],
    });
    mockServices.sharedSessionV2InterruptTurn.mockResolvedValue({
      status: "interrupted",
      attemptId: "attempt-stop",
      engine: "codex",
      bindingKey: "codex:prov-1",
    });
    renderBar();
    await expandAndWaitStopEnabled();
    fireEvent.click(screen.getByText("sharedSend.recoveryStop"));
    await waitFor(() => {
      expect(screen.getByTestId("shared-send-status").textContent).toContain(
        "sharedSend.recoveryHintAfterStop",
      );
    });
    expect(mockServices.sharedSessionV2InterruptTurn).toHaveBeenCalledWith(
      WS,
      THREAD,
      "attempt-stop",
    );
    expect(mockServices.pushErrorToast).not.toHaveBeenCalled();
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
  });

  it("recovery-required：停止请求失败用停止专属文案", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [
        {
          attemptId: "attempt-stop-fail",
          bindingKey: "codex:prov-1",
          accepted: true,
        },
      ],
      bindings: [],
    });
    mockServices.sharedSessionV2InterruptTurn.mockRejectedValue(
      new Error("interrupt failed: engine unavailable"),
    );
    renderBar();
    await expandAndWaitStopEnabled();
    fireEvent.click(screen.getByText("sharedSend.recoveryStop"));
    await waitFor(() => {
      expect(mockServices.pushErrorToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "sharedSend.recoveryStopFailedTitle",
          message: "sharedSend.recoveryErrorGenericStop",
        }),
      );
    });
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
  });

  it("recovery-required：无进行中请求时停止按钮禁用", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [
        {
          bindingKey: "codex:prov-1",
          provisioningState: "recovery-required",
          availability: "available",
        },
      ],
    });
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-expand"));
    await waitFor(() => {
      expect(mockServices.sharedSessionV2TurnState).toHaveBeenCalled();
    });
    const stopBtn = screen.getByText(
      "sharedSend.recoveryStop",
    ) as HTMLButtonElement;
    expect(stopBtn.disabled).toBe(true);
    expect(stopBtn.title).toBe("sharedSend.recoveryStopNoAttempt");
  });

  it("recovery-required：展开后 Probe 无待处理 Attempt 后解锁", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [],
    });
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-expand"));
    fireEvent.click(screen.getByText("sharedSend.recoveryProbe"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
    expect(mockServices.pushErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "sharedSend.recoveryProbeTitle",
        message: "sharedSend.recoveryProbeCleared",
        variant: "success",
      }),
    );
  });

  it("recovery-required：再查一次仍锁时必须 toast 反馈", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [
        {
          attemptId: "attempt-held",
          bindingKey: "codex:prov-1",
          accepted: true,
        },
      ],
      bindings: [],
    });
    mockServices.sharedSessionV2RecoverAttempt.mockResolvedValue({
      status: "unknown",
      attemptId: "attempt-held",
    });
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-expand"));
    fireEvent.click(screen.getByText("sharedSend.recoveryProbe"));
    await waitFor(() => {
      expect(mockServices.pushErrorToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "sharedSend.recoveryProbeTitle",
          message: "sharedSend.recoveryProbeStillLocked",
          variant: "info",
        }),
      );
    });
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
    expect(screen.getByTestId("shared-send-status").textContent).toContain(
      "sharedSend.recoveryProbeHeldNext",
    );
  });

  it("recovery-required：展开后换连接调用 rebuild 并解锁", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [
        {
          bindingKey: "codex:prov-1",
          provisioningState: "recovery-required",
          availability: "available",
        },
      ],
    });
    mockServices.sharedSessionV2RebuildBinding.mockResolvedValue({
      status: "prepared",
      bindingKey: "codex:prov-1",
      nativeThreadId: "native-1",
    });
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-expand"));
    fireEvent.click(screen.getByText("sharedSend.recoveryStopAndRebuild"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
    expect(mockServices.sharedSessionV2RebuildBinding).toHaveBeenCalledWith(
      WS,
      THREAD,
      "codex:prov-1",
    );
  });

  it("recovery-required：换连接在 Runtime own 时先 interrupt", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [
        {
          attemptId: "attempt-owned",
          bindingKey: "codex:prov-1",
          accepted: true,
        },
      ],
      bindings: [],
    });
    mockServices.sharedSessionV2InterruptTurn.mockResolvedValue({
      status: "interrupted",
      attemptId: "attempt-owned",
      engine: "codex",
      bindingKey: "codex:prov-1",
      nativeThreadId: "native-1",
      runtimeTurnId: "run-1",
    });
    mockServices.sharedSessionV2RebuildBinding.mockResolvedValue({
      status: "prepared",
      bindingKey: "codex:prov-1",
    });
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-expand"));
    fireEvent.click(screen.getByText("sharedSend.recoveryStopAndRebuild"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
    expect(mockServices.sharedSessionV2InterruptTurn).toHaveBeenCalledWith(
      WS,
      THREAD,
      "attempt-owned",
    );
  });

  it("recovery-required：跳过取消不调用 abandon", () => {
    enterRecovery();
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-skip"));
    expect(screen.getByTestId("skip-confirm-dialog")).toBeTruthy();
    fireEvent.click(screen.getByText("cancel-skip"));
    expect(
      mockServices.sharedSessionV2AbandonUnresolvedAttempt,
    ).not.toHaveBeenCalled();
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
  });

  it("recovery-required：跳过在 Runtime own 且 interrupt 失败时仍强制解锁", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [
        {
          attemptId: "attempt-force-skip",
          bindingKey: "codex:prov-1",
          accepted: true,
        },
      ],
      bindings: [],
    });
    // 后端 force_stop 合同：interrupt 失败也返回 cancelled-committed
    mockServices.sharedSessionV2AbandonUnresolvedAttempt.mockResolvedValue({
      status: "cancelled-committed",
      attemptId: "attempt-force-skip",
      bindingKey: "codex:prov-1",
      forcedAfterInterruptFailure: true,
      interruptWarning: "Claude runtime turn missing",
    });
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-skip"));
    fireEvent.click(screen.getByText("confirm-skip"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
    expect(
      mockServices.sharedSessionV2AbandonUnresolvedAttempt,
    ).toHaveBeenCalledWith(WS, THREAD, {
      attemptId: "attempt-force-skip",
      forceStop: true,
    });
  });

  it("recovery-required：跳过确认后 durable cancel 解锁", async () => {
    enterRecovery();
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [
        {
          attemptId: "attempt-abandon",
          bindingKey: "codex:prov-1",
          accepted: false,
        },
      ],
      bindings: [],
    });
    mockServices.sharedSessionV2AbandonUnresolvedAttempt.mockResolvedValue({
      status: "cancelled-committed",
      attemptId: "attempt-abandon",
      bindingKey: "codex:prov-1",
      sequence: 9,
    });
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-skip"));
    fireEvent.click(screen.getByText("confirm-skip"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
    expect(
      mockServices.sharedSessionV2AbandonUnresolvedAttempt,
    ).toHaveBeenCalledWith(WS, THREAD, {
      attemptId: "attempt-abandon",
      forceStop: true,
    });
  });

  it("recovery 路径不使用 window.confirm", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    enterRecovery();
    renderBar();
    fireEvent.click(screen.getByTestId("shared-send-recovery-skip"));
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("target-unavailable 引导更换目标", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "targetUnavailable" }, {
      detail: "missing provider",
    });
    renderBar();
    const text = screen.getByTestId("shared-send-status").textContent ?? "";
    expect(text).toContain("sharedSend.targetUnavailableReason");
    expect(text).toContain("sharedSend.targetUnavailableHint");
  });
});
