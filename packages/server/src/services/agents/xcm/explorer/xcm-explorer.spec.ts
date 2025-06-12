import { createReadStream } from 'fs'
import { resolve } from 'path'
import { createInterface } from 'readline'
import { createServices } from '@/testing/services.js'
import { xcmDataDir } from '@/testing/xcm.js'
import { Observable, share } from 'rxjs'
import { beforeEach, describe, it } from 'vitest'
import { XcmHumanizer } from '../humanize/index.js'
import { XcmTracker } from '../tracking.js'
import { XcmExplorer } from './index.js'

describe('XcmExplorer', () => {
  let explorer: XcmExplorer
  let tracker: XcmTracker

  beforeEach(() => {
    const { log } = createServices()

    // Mock tracker with RxJS Observable
    tracker = {
      xcm$: new Observable((subscriber) => {
        const filePath = resolve(xcmDataDir, '001.jsonl')
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

    explorer = new XcmExplorer({
      log,
      humanizer: {
        humanize: (msg: any) => msg,
      } as unknown as XcmHumanizer,
    })
  })

  it('should process XCM messages from the tracker', async () => {
    await explorer.start(tracker)

    const streamCompleted = new Promise<void>((resolve, reject) => {
      tracker.xcm$.subscribe({
        complete: () => resolve(),
        error: (error) => reject(error),
      })
    })

    await streamCompleted

    const { items } = await explorer.listJourneys()
    const { items: journey0 } = await explorer.getJourneyById({ id: 0 })

    expect(items).toBeDefined()
    expect(items.length).toBeGreaterThan(0)
    expect(items.filter((i) => i.transactCalls.length > 0).length).toBeGreaterThan(0)
    expect(items.filter((i) => i.assets.length > 0).length).toBeGreaterThan(0)
    expect(items.filter((i) => i.type === 'transfer').length).toBeGreaterThan(0)
    expect(items.filter((i) => i.type === 'transact').length).toBeGreaterThan(0)

    expect(journey0).toBeDefined()
  })
})
