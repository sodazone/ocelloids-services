import { WebSocket, MessageEvent } from 'isows';

import { QuerySubscription } from 'xcmon-server';

export type {
  QuerySubscription, XcmNotifyMessage
} from 'xcmon-server';

/**
 * The Ocelloids client configuration.
 */
export type OcelloidsClientConfig = {
  /**
   * A string containing the hostname
   * followed by (if a port was specified) a ':' and the port.
   * Could also contain a path prefix without ending slash.
   *
   * Examples:
   * localhost:3000
   * some.where
   * some.where:8080/path-prefix
   */
  host: string,
  /**
   * Indicates if the connection should use a secure protocol or not.
   */
  secure: boolean
}

function isBlob(value: any) {
  if (typeof Blob === 'undefined') {
    return false;
  }
  return value instanceof Blob || Object.prototype.toString.call(value) === '[object Blob]';
}

function handleMessage<T>(
  handler: (message: T) => void
) {
  return (event: MessageEvent) => {
    if (isBlob(event.data)) {
      (event.data as Blob).text().then(
        blob => handler(JSON.parse(blob))
      );
    } else {
      handler(JSON.parse(event.data.toString()));
    }
  };
}

export type WebSocketHandlers<T> = {
  onMessage: (message: T) => void,
  onClose?: (event: CloseEvent) => void,
  onError?: (error: Event) => void
}

/**
 * The Ocelloids client.
 */
export class OcelloidsClient {
  #httpUrl: string;
  #wsUrl: string;

  constructor(config: OcelloidsClientConfig) {
    this.#wsUrl = `${config.secure ? 'wss' : 'ws'}://${config.host}`;
    this.#httpUrl = `${config.secure ? 'https' : 'http'}://${config.host}`;
    // TODO default headers for auth etc
  }

  async create(subscription: QuerySubscription) {
    return new Promise<void>(async (resolve, reject) => {
      const res = await fetch(this.#httpUrl + '/subs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // authentication...
        },
        body: JSON.stringify(subscription),
      });

      if (res.ok) {
        resolve();
      } else {
        reject(await res.json());
      }
    });
  }

  async get(subscriptionId: string)
  : Promise<QuerySubscription> {
    return new Promise<QuerySubscription>(async (resolve, reject) => {
      const res = await fetch(this.#httpUrl + '/subs/' + subscriptionId);
      if (res.ok) {
        resolve((await res.json()) as QuerySubscription);
      } else {
        reject(await res.json());
      }
    });
  }

  async subscribe<T>(
    subscription: string | QuerySubscription,
    handlers: WebSocketHandlers<T>
  ): Promise<WebSocket> {
    const url = this.#wsUrl + '/ws/subs/';

    return typeof subscription === 'string'
      ? this.#openWebSocket<T>(url + subscription, handlers)
      : this.#openWebSocket<T>(url, handlers, subscription);
  }

  #openWebSocket<T>(
    url: string,
    { onMessage, onError, onClose }: WebSocketHandlers<T>,
    sub?: QuerySubscription
  ) {
    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.binaryType = 'blob';

      ws.onmessage = handleMessage(onMessage);

      if (onError) {
        ws.onerror = onError;
      }

      if (onClose) {
        ws.onclose = onClose;
      }

      ws.onopen = () => {
        if (ws.readyState === 1) {
          if (sub) {
            ws.send(JSON.stringify(sub));
          }
          resolve(ws);
        } else {
          reject('ws ready state: ' + ws.readyState);
        }
      };
    });
  }
}