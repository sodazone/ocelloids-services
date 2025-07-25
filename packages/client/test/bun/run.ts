import { createXcmAgent, xcm } from '../..'

const client = createXcmAgent({
  httpUrl: 'http://127.0.0.1:3000',
  wsUrl: 'ws://127.0.0.1:3000',
})

client.health().then(console.log).catch(console.error)

client.subscribe(
  {
    origins: '*',
    senders: '*',
    events: '*',
    destinations: '*',
  },
  {
    onMessage: (msg, ws) => {
      if(xcm.isHumanized(msg.payload)) {
        console.log('HUMANIZED', msg.payload.humanized)
      }

      if (xcm.isXcmReceived(msg)) {
        console.log('RECV', msg.metadata.subscriptionId)
      } else if (xcm.isXcmSent(msg)) {
        console.log('SENT', msg.metadata.subscriptionId)
      }
      console.log(msg)
      ws.close(1001, 'bye!')
    },
    onError: (error) => console.log(error),
    onClose: (event) => console.log(event.reason),
  },
  {
    onSubscriptionCreated: (sub) => {
      console.log('SUB', sub)
    }
  }
)
