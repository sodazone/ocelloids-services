import { AssetRole } from '../../crosschain/index.js'

export type AssetUpdate = {
  asset: string
  role?: AssetRole
  sequence?: number
  amount: string
  usd?: number
}

export function asArray<T>(v?: T | T[] | null): T[] {
  if (!v) {
    return []
  }
  return Array.isArray(v) ? v : [v]
}

function mergeInstructions(targetStop: any, dupStop: any) {
  const target = asArray(targetStop.instructions)
  const incoming = asArray(dupStop.instructions)

  const newInstructions = incoming.filter(
    (instr) =>
      !target.some(
        (i) => i.messageHash === instr.messageHash || (i.messageId && i.messageId === instr.messageId),
      ),
  )

  targetStop.instructions = [...newInstructions, ...target]
}

// NOTE: mutates target stops in place
export function mergeStops(targetStops: any[], dupStops: any[]) {
  for (const dupStop of dupStops) {
    const targetStop = targetStops.find(
      (s) => s.from.chainId === dupStop.from.chainId && s.to.chainId === dupStop.to.chainId,
    )

    if (targetStop) {
      mergeInstructions(targetStop, dupStop)
    }
  }
}

// Use assets with higher value between the 2 journeys
// E.g. J1 Hydration - Moonbeam Transfer 1 GLMR, 5 SOL
// J2 Hydration - Solana EthereumXcm.Transact 0.9 GLMR, 5 SOL
// Updated journey: Hydration - Solana EthereumXcm.Transact 1 GLMR, 5 SOL
// NOTE: mutates target assets in place
export function mergeAssets(
  target: { asset: string; role?: AssetRole; sequence?: number; amount: string; usd?: number }[],
  incoming: typeof target,
): AssetUpdate[] {
  const updates: AssetUpdate[] = []

  for (const i of incoming) {
    const existing = target.find((a) => a.asset === i.asset && a.role === i.role && a.sequence === i.sequence)

    if (!existing) {
      continue
    }

    if (BigInt(i.amount) > BigInt(existing.amount)) {
      existing.amount = i.amount
      existing.usd = i.usd

      updates.push({
        asset: existing.asset,
        role: existing.role,
        sequence: existing.sequence,
        amount: i.amount,
        usd: i.usd,
      })
    }
  }

  return updates
}
