import type { PricingSource } from "../pricingTypes";

// Gemini local usage currently records tokens but does not expose a trusted billing model id.
// Keep the fixture empty so projections degrade instead of showing silent zero cost.
export const GEMINI_PRICING_FIXTURES = [] as const satisfies readonly PricingSource[];
