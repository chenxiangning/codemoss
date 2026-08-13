import { afterEach, describe, expect, it } from "vitest";
import {
  isUserInputRequestSettled,
  markUserInputRequestSettled,
  resetUserInputSettlementTombstonesForTests,
  USER_INPUT_SETTLEMENT_TOMBSTONE_MAX_KEYS,
} from "./userInputSettlementTombstone";

describe("userInputSettlementTombstone", () => {
  afterEach(() => {
    resetUserInputSettlementTombstonesForTests();
  });

  it("marks and reports settled identity keys", () => {
    expect(isUserInputRequestSettled("a")).toBe(false);
    markUserInputRequestSettled("a");
    expect(isUserInputRequestSettled("a")).toBe(true);
  });

  it("ignores empty keys", () => {
    markUserInputRequestSettled("   ");
    expect(isUserInputRequestSettled("   ")).toBe(false);
  });

  it("clears when capacity is exceeded on a new key", () => {
    for (let i = 0; i < USER_INPUT_SETTLEMENT_TOMBSTONE_MAX_KEYS; i += 1) {
      markUserInputRequestSettled(`key-${i}`);
    }
    expect(isUserInputRequestSettled("key-0")).toBe(true);
    markUserInputRequestSettled("overflow");
    expect(isUserInputRequestSettled("key-0")).toBe(false);
    expect(isUserInputRequestSettled("overflow")).toBe(true);
  });
});
