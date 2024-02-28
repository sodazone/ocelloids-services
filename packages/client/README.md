# XCM Monitoring Client Library

Client library for the XCM Monitoring Server.

## Usage

```typescript
import { OcelloidsClient, isXcmReceived, isXcmSent } from "@sodazone/ocelloids-client";

const client = new OcelloidsClient({
  httpUrl: "http://127.0.0.1:3000",
  wsUrl: "ws://127.0.0.1:3000"
});

// subscribe on-demand
const ws = client.subscribe({
  origin: "2004",
  senders: "*",
  events: "*",
  destinations: [ "0","1000", "2000", "2034", "2104" ]
}, {
 onMessage: msg => {
   if(isXcmReceived(msg)) {
     console.log("RECV", msg.subscriptionId);
   } else if(isXcmSent(msg)) {
     console.log("SENT", msg.subscriptionId)
   }
   console.log(msg);
 },
 onError: error => console.log(error),
 onClose: event => console.log(event.reason)
});
```

Please, browse the [documentation site](https://sodazone.github.io/xcm-monitoring/) for details.

## Development

Enable corepack:

```shell
corepack enable
```

Install dependencies and build the project:

```shell
yarn && yarn build
```