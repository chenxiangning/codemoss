import type { RealtimeAdapter } from "../contracts/conversationCurtainContracts";
import { mapCommonRealtimeEvent } from "./sharedRealtimeAdapter";

/** OMP uses the shared ACP event vocabulary; execution remains policy-gated elsewhere. */
export const ompRealtimeAdapter: RealtimeAdapter = {
  engine: "omp",
  mapEvent(input: unknown) {
    return mapCommonRealtimeEvent("omp", input, {
      allowTextDeltaAlias: true,
    });
  },
};
