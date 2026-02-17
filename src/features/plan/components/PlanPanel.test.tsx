// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanPanel } from "./PlanPanel";

describe("PlanPanel", () => {
  it("shows mode guidance when not in plan mode", () => {
    render(<PlanPanel plan={null} isProcessing={false} isPlanMode={false} />);

    expect(screen.getByText("Switch to Plan mode to enable planning")).toBeTruthy();
  });

  it("shows waiting label while processing in plan mode", () => {
    render(<PlanPanel plan={null} isProcessing isPlanMode />);

    expect(screen.getByText("Generating plan...")).toBeTruthy();
  });

  it("shows idle empty label in plan mode", () => {
    render(<PlanPanel plan={null} isProcessing={false} isPlanMode />);

    expect(
      screen.getByText("No plan generated. Send a message to start."),
    ).toBeTruthy();
  });
});
