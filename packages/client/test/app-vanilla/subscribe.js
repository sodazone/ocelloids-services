import { createXcmAgent, xcm } from "../../";

export function setup() {
  const messages = document.querySelector('#messages')
  const status = document.querySelector('#status')

  const client = createXcmAgent({
    httpUrl: 'http://127.0.0.1:3000',
    wsUrl: 'ws://127.0.0.1:3000'
  });

  const ws = client.subscribe({
    origins: ["urn:ocn:polkadot:1000"],
    senders: "*",
    events: "*",
    destinations: ["urn:ocn:polkadot:0"]
  }, {
    onMessage: msg => {
      if (xcm.isXcmSent(msg)) {
        console.log('SENT', msg.metadata.subscriptionId);
      }
      const pre = document.createElement('pre')
      pre.innerHTML = JSON.stringify(msg, null, 2)
      messages.prepend(pre)
    },
    onError: error => {
      console.error(error)
    },
    onClose: event => {
      status.innerHTML = `disconnected: socket closed ${event.reason} (${event.code})`
    }
  })

  status.innerHTML = 'connected ' + ws.readyState
}
