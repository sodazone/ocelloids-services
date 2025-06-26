import { createReadStream } from 'fs'
import { resolve } from 'path'
import { createInterface } from 'readline'
import { createServices } from '@/testing/services.js'
import { xcmDataDir } from '@/testing/xcm.js'
import { Observable, share } from 'rxjs'
import { beforeEach, describe, it } from 'vitest'
import { ServerSideEventsBroadcaster } from '../../types.js'
import { XcmHumanizer } from '../humanize/index.js'
import { XcmTracker } from '../tracking.js'
import { XcmExplorer } from './index.js'

describe('XcmExplorer', () => {
  let explorer: XcmExplorer
  let tracker: XcmTracker
  let broadcaster: ServerSideEventsBroadcaster
  let sendSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const { log } = createServices()

    // Mock tracker with RxJS Observable
    tracker = {
      historicalXcm$: () =>
        new Observable((subscriber) => {
          const filePath = resolve(xcmDataDir, '002.jsonl')
          const stream = createReadStream(filePath, { encoding: 'utf-8' })
          const rl = createInterface({ input: stream })

          rl.on('line', (line) => {
            try {
              const message = JSON.parse(line)
              subscriber.next(message)
            } catch (error) {
              subscriber.error(error)
            }
          })

          rl.on('close', () => subscriber.complete())
          rl.on('error', (error) => subscriber.error(error))
        }).pipe(share()),
    } as unknown as XcmTracker

    sendSpy = vi.fn()
    broadcaster = {
      send: sendSpy,
      stream: vi.fn(),
      close: vi.fn(),
    } as unknown as ServerSideEventsBroadcaster

    explorer = new XcmExplorer({
      log,
      humanizer: {
        humanize: (msg: any) => msg,
      } as unknown as XcmHumanizer,
      broadcaster,
    })
  })

  it('should process XCM messages from the tracker', async () => {
    await explorer.start(tracker)

    const streamCompleted = new Promise<void>((resolve, reject) => {
      tracker.historicalXcm$({}).subscribe({
        complete: () => resolve(),
        error: (error) => reject(error),
      })
    })

    await streamCompleted

    const { items } = await explorer.listJourneys()
    const { items: journey0 } = await explorer.getJourneyById({ id: items[1].correlationId })
    const { items: filteredByType } = await explorer.listJourneys({ type: ['transfer', 'teleport'] })

    const eventTypes = sendSpy.mock.calls.map((call) => call[0]?.event)

    expect(sendSpy).toHaveBeenCalled()
    expect(eventTypes).toContain('new_journey')
    expect(eventTypes).toContain('update_journey')

    expect(items).toBeDefined()
    expect(items.length).toBeGreaterThan(0)
    expect(items.filter((i) => i.transactCalls.length > 0).length).toBeGreaterThan(0)
    expect(items.filter((i) => i.assets.length > 0).length).toBeGreaterThan(0)
    expect(items.filter((i) => i.type === 'transfer').length).toBeGreaterThan(0)
    expect(items.filter((i) => i.type === 'transact').length).toBeGreaterThan(0)

    expect(journey0).toBeDefined()
    expect(filteredByType.length).toBeGreaterThan(0)
  })
})
