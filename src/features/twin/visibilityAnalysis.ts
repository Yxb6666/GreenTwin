export interface LineOfSightThresholds {
  originTolerance?: number
  targetTolerance?: number
}

export function isLineOfSightBlocked(
  totalDistance: number,
  obstructionDistance?: number,
  thresholds: LineOfSightThresholds = {},
) {
  if (
    !Number.isFinite(totalDistance) ||
    totalDistance <= 0 ||
    obstructionDistance === undefined ||
    !Number.isFinite(obstructionDistance)
  ) {
    return false
  }

  const originTolerance = thresholds.originTolerance ?? 2
  const targetTolerance = thresholds.targetTolerance ?? 1
  return (
    obstructionDistance > originTolerance &&
    obstructionDistance < totalDistance - targetTolerance
  )
}
