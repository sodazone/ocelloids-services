import { OcelloidsClient } from "xcmon-client";

export function setup() {
  const messages = document.querySelector('#messages')
  const status = document.querySelector('#status')

  const client = new OcelloidsClient({
    host: 'localhost:3000',
    secure: false
  });

  client.subscribe({
    origin: "2004",
    senders: "*",
    events: "*",
    destinations: ["0", "1000", "2000", "2034", "2104"]
  }, {
    onMessage: msg => {
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
  }).then(() => {
    status.innerHTML = 'connected'
  })
}
