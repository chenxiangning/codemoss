/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from "@testing-library/react";
import { memo, useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import {
  areRuntimeThreadValuesShallowEqual,
  resolveRuntimeThreadCanInterrupt,
  RuntimeThreadProvider,
  useOptionalRuntimeThreadContext,
  useRuntimeThreadCanInterrupt,
  type RuntimeThreadProviderValue,
} from "./runtimeThreadProvider";

const sharedInterrupt = () => {};

function createValue(
  overrides: Partial<RuntimeThreadProviderValue> = {},
): RuntimeThreadProviderValue {
  return {
    activeItems: [],
    activePlan: null,
    activeRateLimits: null,
    activeTokenUsage: null,
    activeTurnId: null,
    canInterrupt: false,
    isProcessing: false,
    isReviewing: false,
    timelinePlan: null,
    interruptTurn: sharedInterrupt,
    runtimeThreadBoundary: { kind: "boundary" },
    ...overrides,
  };
}

describe("runtimeThreadProvider (T2.1 POC)", () => {
  it("shallow-equals only when every field is Object.is-equal", () => {
    const items: unknown[] = [];
    const boundary = { kind: "boundary" };
    const left = createValue({
      canInterrupt: true,
      isProcessing: true,
      activeItems: items,
      runtimeThreadBoundary: boundary,
    });
    const rightSame = createValue({
      canInterrupt: true,
      isProcessing: true,
      activeItems: items,
      runtimeThreadBoundary: boundary,
    });
    const rightDiff = createValue({
      canInterrupt: false,
      isProcessing: true,
      activeItems: items,
      runtimeThreadBoundary: boundary,
    });
    expect(areRuntimeThreadValuesShallowEqual(left, rightSame)).toBe(true);
    expect(areRuntimeThreadValuesShallowEqual(left, rightDiff)).toBe(false);
  });

  it("prefers context canInterrupt over prop when context present", () => {
    expect(
      resolveRuntimeThreadCanInterrupt({
        propCanInterrupt: false,
        contextValue: createValue({ canInterrupt: true }),
      }),
    ).toBe(true);
    expect(
      resolveRuntimeThreadCanInterrupt({
        propCanInterrupt: true,
        contextValue: null,
      }),
    ).toBe(true);
  });

  it("keeps provider value identity stable across parent re-renders when fields unchanged", () => {
    const seen: RuntimeThreadProviderValue[] = [];
    const stableFields = createValue({ canInterrupt: true, isProcessing: false });

    function Probe() {
      const value = useOptionalRuntimeThreadContext();
      const renderCountRef = useRef(0);
      renderCountRef.current += 1;
      if (value) {
        seen.push(value);
      }
      return (
        <div data-testid="probe">
          {renderCountRef.current}:{String(value?.canInterrupt)}
        </div>
      );
    }

    const MemoProbe = memo(Probe);

    function Harness() {
      const [tick, setTick] = useState(0);
      // 字段相同但每次新建外层 object
      const value = {
        ...stableFields,
      };
      return (
        <div>
          <button type="button" onClick={() => setTick((n) => n + 1)}>
            tick-{tick}
          </button>
          <RuntimeThreadProvider value={value}>
            <MemoProbe />
          </RuntimeThreadProvider>
        </div>
      );
    }

    render(<Harness />);
    expect(screen.getByTestId("probe").textContent).toMatch(/^1:true$/);
    const first = seen[0];
    expect(first).toBeTruthy();

    act(() => {
      screen.getByRole("button").click();
    });
    expect(seen[seen.length - 1]).toBe(first);
  });

  it("exposes canInterrupt via narrow hook under provider", () => {
    function InterruptLabel() {
      const canInterrupt = useRuntimeThreadCanInterrupt();
      return <span data-testid="ci">{String(canInterrupt)}</span>;
    }

    render(
      <RuntimeThreadProvider value={createValue({ canInterrupt: true })}>
        <InterruptLabel />
      </RuntimeThreadProvider>,
    );
    expect(screen.getByTestId("ci").textContent).toBe("true");
  });
});
