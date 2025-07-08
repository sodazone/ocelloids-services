import { asJSON } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { createXcmDatabase } from '@/services/agents/xcm/explorer/repositories/db.js'
import { XcmRepository } from '@/services/agents/xcm/explorer/repositories/journeys.js'
import { matchEvent } from '@/services/agents/xcm/ops/util.js'
import { GenericXcmInboundWithContext } from '@/services/agents/xcm/types/messages.js'
import { createSubstrateClient } from '@/services/networking/substrate/client.js'
import { Block, extractEvents } from '@/services/networking/substrate/index.js'
import { resolveDataPath } from '@/services/persistence/util.js'
import { pino } from 'pino'
import { Observable, concatMap, filter, from, map, takeWhile, timer } from 'rxjs'

export const networks = {
  'urn:ocn:polkadot:0': 'wss://rpc.ibp.network/polkadot',
  'urn:ocn:polkadot:1000': 'wss://polkadot-asset-hub-rpc.polkadot.io',
  'urn:ocn:polkadot:1002': 'wss://sys.ibp.network/bridgehub-polkadot',
  'urn:ocn:polkadot:2034': 'wss://hydradx.paras.ibp.network',
  'urn:ocn:polkadot:2004': 'wss://moonbeam.ibp.network',
  'urn:ocn:polkadot:2006': 'wss://rpc.astar.network',
  'urn:ocn:polkadot:2030': 'wss://bifrost-polkadot.ibp.network',
  'urn:ocn:polkadot:2032': 'wss://api.interlay.io/parachain',
  'urn:ocn:polkadot:2000': 'wss://acala-rpc.dwellir.com',
  'urn:ocn:polkadot:3369': 'wss://mythos.ibp.network',
  'urn:ocn:kusama:0': 'wss://rpc.ibp.network/kusama',
  'urn:ocn:kusama:1000': 'wss://asset-hub-kusama.dotters.network',
} as Record<string, string>

const [, , dbPathArg, startArg, endArg, chainArg, statusArg] = process.argv
const dbPath = dbPathArg
const startBlock = startArg ? Number(startArg) : -1
const endBlock = endArg ? Number(endArg) : -1
const chain = chainArg

const allowedStatuses = ['received', 'failed', 'sent', 'timeout'] as const
type StatusType = (typeof allowedStatuses)[number]

let statusList: StatusType[] = ['timeout']
if (statusArg) {
  statusList = statusArg
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is StatusType => allowedStatuses.includes(s as StatusType))
  if (statusList.length === 0) {
    console.error(`Invalid status list. Allowed: ${allowedStatuses.join(', ')}`)
    process.exit(1)
  }
}

if (
  dbPath === undefined ||
  startBlock < 0 ||
  endBlock <= startBlock ||
  chain === undefined ||
  !chain.startsWith('urn:ocn')
) {
  console.log('usage: backfill.js /db/path 12000000 12000100 urn:ocn:polkadot:0')
  process.exit(1)
}

const ws = networks[chain]
if (!ws) {
  throw new Error(`Network not found: ${chain}`)
}

const log = pino()
const api = await createSubstrateClient(log, chain, ws)

function backfillBlocks$({ start, end }: { start: number; end: number }): Observable<Block> {
  return timer(0, 100).pipe(
    map((index) => start + index),
    takeWhile((blockNumber) => blockNumber <= end),
    concatMap((blockNumber) =>
      from(api.getBlockHash(blockNumber)).pipe(concatMap((blockHash) => from(api.getBlock(blockHash)))),
    ),
  )
}

function getMessageId(instructions: any) {
  for (const instruction of instructions.value) {
    if (instruction.type === 'SetTopic') {
      return typeof instruction.value === 'string' ? instruction.value : instruction.value.asHex()
    }
  }
}

const filename = resolveDataPath('db.xcm-explorer.sqlite', dbPath)
log.info('[xcm:explorer] database at %s', filename)
log.info('[xcm:explorer] backfilling for status %s', statusList)

const { db, migrator: _migrator } = createXcmDatabase(filename)
const migrator = _migrator
const repository = new XcmRepository(db)
await migrator.migrateToLatest()

const { nodes } = await repository.listFullJourneys(
  {
    destinations: [chain],
    status: statusList,
  },
  {
    limit: 100,
  },
)
const mappedNodes = nodes.map((journey) => ({
  id: journey.id,
  correlationId: journey.correlation_id,
  messageId: getMessageId(journey.instructions),
  destination: journey.destination,
  stops: journey.stops,
}))

const METHODS_XCMP_QUEUE = ['Success', 'Fail']

backfillBlocks$({ start: startBlock, end: endBlock })
  .pipe(
    extractEvents(),
    map((event) => {
      if (matchEvent(event, 'XcmpQueue', METHODS_XCMP_QUEUE)) {
        const xcmpQueueData = event.value

        return new GenericXcmInboundWithContext({
          event: event,
          extrinsicHash: event.extrinsic?.hash as HexString,
          blockHash: event.blockHash as HexString,
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
          extrinsicPosition: event.extrinsicPosition,
          messageHash: xcmpQueueData.message_hash,
          messageId: xcmpQueueData.message_id,
          outcome: event.name === 'Success' ? 'Success' : 'Fail',
          error: xcmpQueueData.error,
        })
      } else if (matchEvent(event, 'MessageQueue', 'Processed')) {
        const { id, success, error } = event.value
        // Received event only emits field `message_id`,
        // which is actually the message hash in chains that do not yet support Topic ID.
        const messageId = id
        const messageHash = messageId

        return new GenericXcmInboundWithContext({
          event: event,
          extrinsicHash: event.extrinsic?.hash as HexString,
          blockHash: event.blockHash as HexString,
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
          messageHash,
          messageId,
          outcome: success ? 'Success' : 'Fail',
          error,
        })
      } else if (matchEvent(event, 'DmpQueue', 'ExecutedDownward')) {
        const { message_id, outcome } = event.value

        // Received event only emits field `message_id`,
        // which is actually the message hash in chains that do not yet support Topic ID.
        const messageId = message_id
        const messageHash = messageId

        return new GenericXcmInboundWithContext({
          event: event,
          extrinsicHash: event.extrinsic?.hash as HexString,
          blockHash: event.blockHash as HexString,
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
          messageHash,
          messageId,
          outcome: outcome.type === 'Complete' ? 'Success' : 'Fail',
          error: null,
        })
      }

      return null
    }),
    filter((msg) => msg !== null),
  )
  .subscribe({
    next: async (msg) => {
      log.info('RECEIVED id=%s, outcome=%s (#%s)', msg.messageId, msg.outcome, msg.blockNumber)
      try {
        const found = mappedNodes.find((n) => n.messageId === msg.messageId)
        if (found) {
          if (found.destination !== chain) {
            log.info('Destination %s different from chainId %s, skipping', found.destination, chain)
            return
          }
          found.stops[found.stops.length - 1].to = {
            chainId: chain,
            blockHash: msg.blockHash,
            blockNumber: msg.blockNumber,
            timestamp: msg.timestamp,
            status: msg.outcome,
            extrinsic: {
              blockPosition: msg.extrinsicPosition,
              hash: msg.extrinsicHash,
            },
            event: {
              blockPosition: (msg.event as any)?.blockPosition,
              module: (msg.event as any)?.module,
              name: (msg.event as any)?.name,
            },
          }
          await repository.updateJourney(found.id, {
            status: msg.outcome === 'Success' ? 'received' : 'failed',
            recv_at: msg.timestamp,
            stops: asJSON(found.stops),
          })
          log.info('Updated %s', found.id)
        }
      } catch (error) {
        log.error(error)
      }
    },
    complete: () => {
      log.info('STREAM COMPLETE')
    },
  })
