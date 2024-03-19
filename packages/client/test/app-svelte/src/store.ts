import { writable } from 'svelte/store';
import { OcelloidsClient, isXcmSent, type XcmSent } from '../../../dist/lib';

export const createSubscriptionStore = async () => {
    const { subscribe, set, update } = writable<string[]>([]);

    const client = new OcelloidsClient({
        wsUrl: 'ws://localhost:3000',
        httpUrl: 'http://localhost:3000'
      });
    
    const ws = client.subscribe({
        origin: "urn:ocn:polkadot:2004",
        senders: "*",
        events: "*",
        destinations: ["urn:ocn:polkadot:0", "urn:ocn:polkadot:1000", "urn:ocn:polkadot:2000", "urn:ocn:polkadot:2034", "urn:ocn:polkadot:2104"]
      }, {
        onMessage: msg => {
          if(isXcmSent(msg)) {
            const sent = msg as XcmSent;
            console.log(sent.type, sent.subscriptionId)
          }
          update(messages => [JSON.stringify(msg)].concat(messages))
        },
        onError: error => {
          console.error(error)
        }
      })

    return {
        subscribe,
        reset: () => set([]),
        close: ws.close,
    };
};