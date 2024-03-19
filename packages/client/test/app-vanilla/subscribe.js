import { OcelloidsClient, isXcmSent } from "../../";

export function setup() {
  const messages = document.querySelector('#messages')
  const status = document.querySelector('#status')

  const client = new OcelloidsClient({
    httpUrl: 'http://127.0.0.1:3000',
    wsUrl: 'ws://127.0.0.1:3000'
  });

  const ws = client.subscribe({
    origin: "urn:ocn:polkadot:2004",
    senders: "*",
    events: "*",
    destinations: ["urn:ocn:polkadot:0", "urn:ocn:polkadot:1000", "urn:ocn:polkadot:2000", "urn:ocn:polkadot:2034", "urn:ocn:polkadot:2104"]
  }, {
    onMessage: msg => {
      if(isXcmSent(msg)) {
        console.log('SENT', msg.subscriptionId);
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
