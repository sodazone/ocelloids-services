import { root } from '../../src/placeholder';
import { OcelloidsClient, QuerySubscription, XcmNotifyMessage } from '../../src/lib';

root().then(async res =>
  console.log(await res.text())
);

const client = new OcelloidsClient({
  host: '127.0.0.1:3000',
  secure: false
});

client.subscribe<XcmNotifyMessage>('moonbeam-transfers', {
  onMessage: msg => console.log(msg.subscriptionId, msg.sender),
  onError: error => console.log(error),
  onClose: event => console.log(event.reason)
}).then(ws => {
  console.log('subscribed', ws.readyState);
});

//client.get('mandala-transfers').then(console.log).catch(console.error);
//client.get('moonbeam-transfers').then(console.log).catch(console.error);
client.create({ nono:1 } as unknown as QuerySubscription).then(console.log).catch(console.error);