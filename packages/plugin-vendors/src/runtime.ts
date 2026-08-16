export {
  activateEngineProviderProfileAndNotify,
  isActivatableProviderEngine,
  syncClaudeModelMappingForProfile,
} from "../../../src/features/vendors/activateEngineProviderProfile";
export { requestVendorModelManager } from "../../../src/features/vendors/modelManagerRequest";
export {
  PROVIDER_BRAND_ICON_SRC,
  resolveProviderBrandIcon,
} from "../../../src/features/vendors/providerBrandIcon";
export { ProviderBrandIconImg } from "../../../src/features/vendors/components/ProviderBrandIconImg";
export {
  isValidModelId,
  MODEL_ID_PATTERN,
} from "../../../src/features/vendors/types";
export type {
  ClaudeCurrentConfig,
  CodexProviderConfig,
  GrokCurrentConfig,
  GrokProviderConfig,
  GrokProviderDeleteResult,
  KimiCurrentConfig,
  KimiProviderConfig,
  KimiProviderDeleteResult,
  OpenCodeCurrentConfig,
  OpenCodeProviderConfig,
  ProviderConfig,
} from "../../../src/features/vendors/types";
