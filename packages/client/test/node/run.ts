import { OcelloidsClient, xcm } from '../..'

const client = new OcelloidsClient({
  httpUrl: 'http://127.0.0.1:3000',
  wsUrl: 'ws://127.0.0.1:3000',
})

client.health().then(console.log).catch(console.error)

client.agent<xcm.XcmInputs>("xcm").subscribe(
  {
    origin: 'urn:ocn:polkadot:0',
    senders: '*',
    events: '*',
    destinations: [
      'urn:ocn:polkadot:1000'
    ],
  },
  {
    onMessage: (msg, ws) => {
      if (xcm.isXcmReceived(msg)) {
        console.log('RECV', msg.subscriptionId)
      } else if (xcm.isXcmSent(msg)) {
        console.log('SENT', msg.subscriptionId)
      }
      console.log(msg)
      ws.close(1001, 'bye!')
    },
    onError: (error) => console.log(error),
    onClose: (event) => console.log(event.reason),
  }
)
