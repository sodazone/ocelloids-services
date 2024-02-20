import { writable } from 'svelte/store';
import { OcelloidsClient, isXcmSent, type XcmSent } from 'xcmon-client';

export const createSubscriptionStore = async () => {
    const { subscribe, set, update } = writable<string[]>([]);

    const client = new OcelloidsClient({
        wsUrl: 'ws://localhost:3000',
        httpUrl: 'http://localhost:3000'
      });
    
    const ws = await client.subscribe({
        origin: "2004",
        senders: "*",
        events: "*",
        destinations: ["0", "1000", "2000", "2034", "2104"]
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