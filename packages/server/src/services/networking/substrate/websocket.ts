import { WebSocket  } from 'ws';

const PING_TIMEOUT = 45_000;

export class WS extends WebSocket {
  constructor(...args: ConstructorParameters<typeof WebSocket>) {
    super(...args)

    let timeoutToken: NodeJS.Timeout
    // Triggers "close" on network failure
    // (e.g. when pulling the cord, datacenter network infra migrations, &c.)
    function heartbeat(this: WebSocket) {
      clearTimeout(timeoutToken);

      // Use `WebSocket#terminate()`, which immediately destroys the connection,
      // instead of `WebSocket#close()`, which waits for the close timer.
      // Safe assumption of 45 seconds ping frequency + latency.
      timeoutToken = setTimeout(() => {
        console.warn(`Terminate: ping timeout (${PING_TIMEOUT/1_000}s)`);
        this.terminate();
      }, PING_TIMEOUT);
    }

    this.on('ping', heartbeat);
    this.on('close', function clear() {
      clearTimeout(timeoutToken);
    });
  }

  close() {
    this.terminate();
  }
}
