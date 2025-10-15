import { Binary } from 'polkadot-api'
import { firstValueFrom } from 'rxjs'

import { HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { Event } from '../../networking/substrate/types.js'

export type Proposal =
  | { type: 'Lookup'; value: { hash: string; len: number } }
  | { type: 'Inline'; value: Uint8Array }
  | { type: string; value: any } // Legacy / unknown

export type Tally = {
  ayes: bigint
  nays: bigint
  support: bigint
}

export type OngoingReferendum = {
  type: 'Ongoing'
  value: {
    track: number
    origin: { type: string; value: any }
    proposal: Proposal
    enactment: { type: string; value: any }
    submitted: number
    submission_deposit: { who: string; amount: bigint }
    decision_deposit: { who: string; amount: bigint }
    deciding: { since: number; confirming?: any }
    tally?: Tally
    in_queue: boolean
    alarm: any
  }
}

export type FinalizedReferendum = {
  type: 'Approved' | 'Rejected' | 'Cancelled' | 'TimedOut' | 'Killed'
  value: [
    blockNumber: number,
    submissionDeposit: { who: string; amount: bigint },
    decisionDeposit: { who: string; amount: bigint },
  ]
}

export type ReferendumInfo = OngoingReferendum | FinalizedReferendum

type ReferendumEvent = { index: number }

export type OpenGovApi = Awaited<ReturnType<typeof withOpenGov>>
export type OpenGovEvent = NonNullable<
  Awaited<ReturnType<Awaited<ReturnType<typeof withOpenGov>>['asOpenGovEvent']>>
> & { scheduled?: { when: number; index: number } }

export async function withOpenGov(chainId: NetworkURN, api: SubstrateIngressConsumer) {
  const ctx = await firstValueFrom(api.getContext(chainId))

  /** Decode a call from bytes or hex */
  async function decodeCall(callData: string | Uint8Array) {
    return ctx.decodeCall(callData)
  }

  /** Decode a proposal (Lookup or Inline) */
  async function decodeProposal(proposal: Proposal, at?: HexString) {
    if (proposal.type === 'Lookup') {
      const { hash, len } = proposal.value
      const preimage = await api.query(
        chainId,
        { module: 'Preimage', method: 'PreimageFor', at },
        typeof hash === 'string' ? Binary.fromHex(hash) : hash,
        len,
      )
      return await decodeCall(preimage.asBytes())
    } else if (proposal.type === 'Inline') {
      return await decodeCall(proposal.value)
    }
    return null
  }

  /** Fetch a single referendum, supporting ongoing and finalized */
  async function getReferendum(
    id: number,
    at?: HexString,
  ): Promise<{
    id: number
    info: ReferendumInfo
    decodedCall?: any
  } | null> {
    const info = await api.query<ReferendumInfo>(
      chainId,
      { module: 'Referenda', method: 'ReferendumInfoFor', at },
      id,
    )
    if (!info) {
      return null
    }
    const decodedCall =
      info.type === 'Ongoing' && info.value.proposal
        ? await decodeProposal(info.value.proposal, at)
        : undefined

    return { id, info, decodedCall }
  }

  /**
   * Extract structured info from an OpenGov event and enrich with referendum state.
   *
   * Handles ongoing and finalized referenda, safe decoding, and execution scheduling.
   */
  async function asOpenGovEvent(
    { event, block }: { event: Event; block: { number: number; hash: HexString } },
    ops: {
      avgBlockTimeMs?: number
      chainId?: string
    } = {},
  ) {
    if (event.module !== 'Referenda') {
      return null
    }

    const eventName = event.name
    const eventData = event.value as ReferendumEvent
    const index = (eventData as any)?.index

    if (typeof index !== 'number') {
      console.warn('[asOpenGovEvent] Event without index')
      return null
    }

    let referendum: Awaited<ReturnType<typeof getReferendum>> | undefined = undefined
    try {
      referendum = await getReferendum(index, block.hash)
    } catch (err) {
      console.warn(`[asOpenGovEvent] Failed to fetch referendum ${index}:`, err)
      return null
    }

    if (!referendum) {
      console.warn(`[asOpenGovEvent] Empty referendum ${index} (${block.hash})`)
      return null
    }

    const { info } = referendum
    const { value, type: status } = info ?? {}

    const avgBlockTimeMs = ops.avgBlockTimeMs ?? 6_000
    const currentBlock = block.number ?? 0

    let submittedAt: number | undefined = undefined
    let decisionStartedAt: number | undefined = undefined
    let confirmationStartedAt: number | undefined = undefined
    let finalizedAt: number | undefined = undefined
    let willFinalizeAt: number | undefined = undefined
    let willExecuteAt: number | undefined = undefined
    let etaMs: number | undefined = undefined
    let willExecuteAtUtc: string | undefined = undefined
    let submissionDeposit: { who: string; amount: string } | undefined = undefined
    let decisionDeposit: { who: string; amount: string } | undefined = undefined

    if (Array.isArray(value)) {
      // finalized referendum [finalizedAt, submitDeposit, decisionDeposit]
      finalizedAt = value[0] ?? null
    } else if (value && typeof value === 'object') {
      // ongoing referendum info
      submittedAt = value.submitted ?? null
      decisionStartedAt = value.deciding?.since ?? null
      confirmationStartedAt = value.deciding?.confirming ?? null

      const alarmAt = Array.isArray(value.alarm) ? value.alarm[0] : null
      const confirmBlock = confirmationStartedAt ?? alarmAt ?? null
      willFinalizeAt = confirmBlock

      const enactment = value.enactment
      if (enactment) {
        if (enactment.type === 'After' && confirmBlock) {
          willExecuteAt = confirmBlock + Number(enactment.value)
        } else if (enactment.type === 'At') {
          willExecuteAt = Number(enactment.value)
        }
      }

      if (value.decision_deposit) {
        decisionDeposit = {
          amount: value.decision_deposit.amount.toString(),
          who: value.decision_deposit.who,
        }
      }
      if (value.submission_deposit) {
        submissionDeposit = {
          amount: value.submission_deposit.amount.toString(),
          who: value.submission_deposit.who,
        }
      }

      if (willExecuteAt && currentBlock && willExecuteAt > currentBlock) {
        etaMs = (willExecuteAt - currentBlock) * avgBlockTimeMs
        willExecuteAtUtc = new Date(Date.now() + etaMs).toISOString()
      }
    }

    return {
      id: referendum.id ?? index,
      chainId,
      triggeredBy: {
        name: `Referenda.${eventName}`,
        data: eventData,
        blockHash: block.hash,
        blockNumber: block.number,
      },
      blockNumber: String(block.number ?? submittedAt ?? finalizedAt ?? 0),
      status: status ?? 'Finalized',
      info: value,
      decodedCall: referendum.decodedCall,
      timeline: {
        submittedAt,
        decisionStartedAt,
        confirmationStartedAt,
        finalizedAt,
        willFinalizeAt,
        willExecuteAt,
        etaMs,
        willExecuteAtUtc,
      },
      deposits: {
        submissionDeposit,
        decisionDeposit,
      },
    }
  }

  return {
    getReferendum,
    asOpenGovEvent,
  }
}
