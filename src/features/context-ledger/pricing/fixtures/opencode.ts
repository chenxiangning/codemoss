import type { PricingSource } from "../pricingTypes";

// OpenCode can route to user-defined providers. Without provider-specific pricing, cost must degrade.
export const OPENCODE_PRICING_FIXTURES = [] as const satisfies readonly PricingSource[];
