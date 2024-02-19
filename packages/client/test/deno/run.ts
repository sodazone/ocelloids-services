import { OcelloidsClient } from '../../dist/deno/mod.ts';

const client = new OcelloidsClient({
  httpUrl: 'http://127.0.0.1:3000',
  wsUrl: 'ws://127.0.0.1:3000'
});

client.health().then(console.log).catch(console.error)

client.subscribe(
  { 
    origin: "2004",
    senders: "*",
    events: "*",
    destinations: [ "0","1000", "2000", "2034", "2104" ]
  }, {
  onMessage: (msg, ws) => {
    console.log(msg);
    ws.close(1001, 'bye!');
  },
  onError: error => console.log(error),
  onClose: event => console.log(event.reason)
}).then(ws => {
  console.log('subscribed', ws.readyState);
});