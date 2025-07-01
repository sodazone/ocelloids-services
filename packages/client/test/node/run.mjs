import { createXcmAgent } from '../../dist/lib.js';

const client = createXcmAgent({
  httpUrl: 'http://127.0.0.1:3000',
  wsUrl: 'ws://127.0.0.1:3000'
});

client.health().then(console.log).catch(console.error)

client.subscribe(
  {
    origins: ["urn:ocn:polkadot:0"],
    senders: "*",
    events: "*",
    destinations: ["urn:ocn:polkadot:1000"]
  },
  {
    onMessage: (msg, ws) => {
      console.log(msg);
      ws.close(1001, 'bye!');
    },
    onError: error => console.log(error),
    onClose: event => console.log(event.reason)
  }
);
