import { OcelloidsClient, isXcmReceived, isXcmSent } from '../../dist/deno/mod.ts';

const client = new OcelloidsClient({
  httpUrl: 'http://127.0.0.1:3000',
  wsUrl: 'ws://127.0.0.1:3000'
});

client.health().then(console.log).catch(console.error)

client.subscribe(
  { 
    origin: "urn:ocn:polkadot:2004",
    senders: "*",
    events: "*",
    destinations: [ "urn:ocn:polkadot:0","urn:ocn:polkadot:1000", "urn:ocn:polkadot:2000", "urn:ocn:polkadot:2034", "urn:ocn:polkadot:2104" ]
  }, {
  onMessage: (msg, ws) => {
    if(isXcmReceived(msg)) {
      console.log("RECV", msg.subscriptionId);
    } else if(isXcmSent(msg)) {
      console.log("SENT", msg.subscriptionId)
    }
    console.log(msg);
    ws.close(1000, 'bye!');
  },
  onError: error => console.log(error),
  onClose: event => console.log(event.reason)
});