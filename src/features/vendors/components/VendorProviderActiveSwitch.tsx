import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { DISABLED_PROVIDER_ID } from "../types";

type VendorProviderActiveSwitchProps = {
  /** Whether this provider channel is currently the active source */
  active: boolean;
  /** Activate this provider id */
  providerId: string;
  /** Human-readable name for aria labeling */
  providerName: string;
  onSwitch: (id: string) => void;
};

/**
 * Exclusive provider activation control.
 * ON → activate this channel; OFF (when active) → fall back to official/disabled.
 */
export function VendorProviderActiveSwitch({
  active,
  providerId,
  providerName,
  onSwitch,
}: VendorProviderActiveSwitchProps) {
  const { t } = useTranslation();
  const label = active
    ? t("settings.vendor.inUse")
    : t("settings.vendor.enable");

  return (
    <Switch
      checked={active}
      aria-label={`${label}: ${providerName}`}
      onCheckedChange={(checked) => {
        if (checked) {
          if (!active) {
            onSwitch(providerId);
          }
          return;
        }
        if (active) {
          onSwitch(DISABLED_PROVIDER_ID);
        }
      }}
    />
  );
}
