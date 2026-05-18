import type { EngineType } from "../../../types";
import type {
  CostAmount,
  CostRecord,
  EngineCostBreakdown,
  WorkspaceCostAggregate,
} from "./costTypes";

const USD: CostAmount["currency"] = "USD";

function sumKnownAmounts(records: readonly CostRecord[]): CostAmount | null {
  const knownRecords = records.filter((record) => record.amount !== null && !record.degraded);
  if (knownRecords.length === 0) {
    return null;
  }
  return {
    amount: knownRecords.reduce((sum, record) => sum + (record.amount?.amount ?? 0), 0),
    currency: USD,
  };
}

function engineSort(left: EngineType, right: EngineType): number {
  return left.localeCompare(right);
}

export function aggregateCostRecords(
  records: readonly CostRecord[],
): WorkspaceCostAggregate {
  const engines = [...new Set(records.map((record) => record.engine))].sort(engineSort);
  const engineBreakdown: EngineCostBreakdown[] = engines.map((engine) => {
    const engineRecords = records.filter((record) => record.engine === engine);
    return {
      engine,
      amount: sumKnownAmounts(engineRecords),
      partial: engineRecords.some((record) => record.degraded),
      records: engineRecords,
    };
  });
  return {
    amount: sumKnownAmounts(records),
    currency: USD,
    partial: records.some((record) => record.degraded),
    records,
    engineBreakdown,
  };
}
