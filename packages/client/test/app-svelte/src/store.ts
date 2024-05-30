import { writable } from 'svelte/store'
import { OcelloidsClient, xcm } from '../../../dist/lib'

export const createSubscriptionStore = async () => {
  const { subscribe, set, update } = writable<string[]>([])

  const client = new OcelloidsClient({
    wsUrl: 'ws://localhost:3000',
    httpUrl: 'http://localhost:3000',
  })

  const ws = client.subscribe({
    agent: 'xcm',
    args:
    {
      origin: 'urn:ocn:polkadot:1000',
      senders: '*',
      events: '*',
      destinations: [
        'urn:ocn:polkadot:0',
      ],
    }
  },
    {
      onMessage: (msg) => {
        if (xcm.isXcmSent(msg)) {
          const sent = msg as xcm.XcmSent
          console.log(sent.type, sent.subscriptionId)
        }
        update((messages) => [JSON.stringify(msg)].concat(messages))
      },
      onError: (error) => {
        console.error(error)
      },
    }
  )

  return {
    subscribe,
    reset: () => set([]),
    close: ws.close,
  }
}
