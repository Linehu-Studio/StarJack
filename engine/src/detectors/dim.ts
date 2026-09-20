import type { DimensionId, DimensionResult, EvidenceItem } from '../types';
import { WEIGHTS } from './weights';

/** 构造维度结果：clamp 到 0-100 并附带权重 */
export function dim(
  id: DimensionId,
  score: number,
  available: boolean,
  evidence: EvidenceItem[],
): DimensionResult {
  return {
    id,
    score: Math.round(Math.max(0, Math.min(100, score))),
    weight: WEIGHTS[id],
    available,
    evidence,
  };
}
