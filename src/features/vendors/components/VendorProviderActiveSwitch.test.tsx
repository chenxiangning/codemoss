// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DISABLED_PROVIDER_ID } from "../types";
import { VendorProviderActiveSwitch } from "./VendorProviderActiveSwitch";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("VendorProviderActiveSwitch", () => {
  it("activates the provider when toggled on", () => {
    const onSwitch = vi.fn();
    render(
      <VendorProviderActiveSwitch
        active={false}
        providerId="p1"
        providerName="Alpha"
        onSwitch={onSwitch}
      />,
    );

    fireEvent.click(
      screen.getByRole("switch", { name: "settings.vendor.enable: Alpha" }),
    );
    expect(onSwitch).toHaveBeenCalledWith("p1");
  });

  it("falls back to disabled when the active provider is toggled off", () => {
    const onSwitch = vi.fn();
    render(
      <VendorProviderActiveSwitch
        active
        providerId="p1"
        providerName="Alpha"
        onSwitch={onSwitch}
      />,
    );

    fireEvent.click(
      screen.getByRole("switch", { name: "settings.vendor.inUse: Alpha" }),
    );
    expect(onSwitch).toHaveBeenCalledWith(DISABLED_PROVIDER_ID);
  });
});
