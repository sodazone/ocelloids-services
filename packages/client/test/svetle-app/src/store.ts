import { writable } from 'svelte/store';
import { OcelloidsClient, type QuerySubscription, type XcmNotifyMessage } from 'xcmon-client';

export const createSubscriptionStore = async () => {
    const { subscribe, set, update } = writable<string[]>([]);

    const client = new OcelloidsClient({
        host: 'localhost:3000',
        secure: false
      });
    
    const ws = await client.subscribe<QuerySubscription | XcmNotifyMessage>({
        origin: "2004",
        senders: "*",
        events: "*",
        destinations: ["0", "1000", "2000", "2034", "2104"]
      }, {
        onMessage: msg => {
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