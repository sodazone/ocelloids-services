import { from, lastValueFrom } from 'rxjs'

import '@/testing/network.js'

import { createServices } from '@/testing/services.js'

import Connector from '../../connector.js'
import { NeutralHeader } from '../../types.js'
import { BitcoinApi } from '../client.js'
import { BitcoinWatcher } from './watcher.js'

async function simulateReorg(tracked: NeutralHeader[], replaced: NeutralHeader[] = []) {
  const getNeutralBlockHeader = vi.fn((hash: string) => {
    return Promise.resolve(replaced.find((h) => h.hash === hash))
  })
  const mockServices = createServices()
  mockServices.connector = {
    connect: () => ({
      'urn:ocn:bitcoin:0': {
        followHeads$: from(tracked),
        getBlock: (hash: string) => {
          return Promise.resolve({ hash })
        },
        getNeutralBlockHeader,
      } as unknown as BitcoinApi,
    }),
  } as unknown as Connector
  const watcher = new BitcoinWatcher(mockServices)
  await lastValueFrom(watcher.finalizedBlocks('urn:ocn:bitcoin:0'))
  return { heads: watcher.headsCache('urn:ocn:bitcoin:0'), getHeader: getNeutralBlockHeader }
}

describe('Bitcoin watcher', () => {
  describe('re-orgs', () => {
    it('should handle a canonical chain', async () => {
      const { heads, getHeader } = await simulateReorg(
        new Array(50).fill(null).map((_, i) => ({
          height: i,
          hash: `0xC${i}`,
          parenthash: `0xC${i === 0 ? 0 : i - 1}`,
        })),
      )

      expect(getHeader).not.toBeCalled()
      expect((await heads.keys().all()).length).toBe(50)
      expect((await heads.get('2')).hash).toBe('0xC2')
    })

    it.skip('should prune heads cache', async () => {
      const { heads, getHeader } = await simulateReorg(
        new Array(505).fill(null).map((_, i) => ({
          height: i,
          hash: `0xC${i}`,
          parenthash: `0xC${i === 0 ? 0 : i - 1}`,
        })),
      )

      expect(getHeader).not.toBeCalled()
      expect((await heads.keys().all()).length).toBe(500)
      expect((await heads.get('504')).hash).toBe('0xC504')
    })

    it('should handle a 50 blocks re-org', async () => {
      const headers = new Array(51).fill(null).map((_, i) => ({
        height: i,
        hash: `0xC${i}`,
        parenthash: `0xC${i === 0 ? 0 : i - 1}`,
      }))
      const replaced = headers.slice(2)
      const orphans = replaced.map((b) => ({
        ...b,
        hash: b.hash.replace('C', 'F'),
        parenthash: b.parenthash.replace('C', 'F'),
      }))
      orphans[0].parenthash = orphans[0].parenthash.replace('F', 'C')
      const tracked = [...headers.slice(0, 2), ...orphans]
      tracked[50].hash = '0xC50'
      tracked[50].parenthash = '0xC49'

      const { heads, getHeader } = await simulateReorg(tracked, replaced)

      expect(getHeader).toBeCalledTimes(48)
      expect((await heads.keys().all()).length).toBe(51)
      expect((await heads.get('25')).hash).toBe('0xC25')
    })

    it('should handle a 2 blocks re-org', async () => {
      const { heads, getHeader } = await simulateReorg(
        [
          {
            height: 0,
            hash: '0xC0',
            parenthash: '0x0',
          },
          {
            height: 1,
            hash: '0xC1',
            parenthash: '0xC0',
          },
          {
            height: 2,
            hash: '0xF2',
            parenthash: '0xC1',
          },
          {
            height: 3,
            hash: '0xF3',
            parenthash: '0xF2',
          },
          {
            height: 4,
            hash: '0xC4',
            parenthash: '0xC3',
          },
        ],
        [
          {
            height: 3,
            hash: '0xC3',
            parenthash: '0xC2',
          },
          {
            height: 2,
            hash: '0xC2',
            parenthash: '0xC1',
          },
        ],
      )

      expect(getHeader).toBeCalledTimes(2)
      expect(await heads.keys().all()).toStrictEqual(['0', '1', '2', '3', '4'])
      expect((await heads.get('2')).hash).toBe('0xC2')
    })

    it('should handle a 1 block re-org', async () => {
      const { heads, getHeader } = await simulateReorg(
        [
          {
            height: 0,
            hash: '0xC0',
            parenthash: '0x0',
          },
          {
            height: 1,
            hash: '0xC1',
            parenthash: '0xC0',
          },
          {
            height: 2,
            hash: '0xF2',
            parenthash: '0xC1',
          },
          {
            height: 3,
            hash: '0xC3',
            parenthash: '0xC2',
          },
        ],
        [
          {
            height: 2,
            hash: '0xC2',
            parenthash: '0xC1',
          },
        ],
      )

      expect(getHeader).toBeCalledTimes(1)
      expect(await heads.keys().all()).toStrictEqual(['0', '1', '2', '3'])
      expect((await heads.get('2')).hash).toBe('0xC2')
    })
  })
})
