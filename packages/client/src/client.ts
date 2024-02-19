import { WebSocket, type MessageEvent } from 'isows';

import type { OnDemandQuerySubscription } from './types';

import type { QuerySubscription, XcmNotifyMessage } from './server-types';

/**
 * The Ocelloids client configuration.
 */
export type OcelloidsClientConfig = {
  wsUrl: string;
  httpUrl: string;
  httpAuthToken?: string;
  wsAuthToken?: string;
}

function isBlob(value: any) {
  if (typeof Blob === 'undefined') {
    return false;
  }
  return value instanceof Blob || Object.prototype.toString.call(value) === '[object Blob]';
}

type MessageHandler<T> = (message: T, ws: WebSocket, event: MessageEvent) => void;
type CloseHandler = (event: CloseEvent) => void;
type ErrorHandler = (error: Event) => void;

export type WebSocketHandlers = {
  onMessage: MessageHandler<XcmNotifyMessage>,
  onClose?: CloseHandler,
  onError?: ErrorHandler
}

class Protocol {
  #queue : MessageHandler<any>[] = new Array();
  #stream: MessageHandler<XcmNotifyMessage>;
  #isStreaming: boolean;

  constructor(stream: MessageHandler<XcmNotifyMessage>) {
    this.#stream = stream;
    this.#isStreaming = false;
  }

  next<T>(handler: MessageHandler<T>) {
    this.#queue.push(handler);
  }

  handle(event: MessageEvent) {
    const ws = event.target as WebSocket;
    let current: MessageHandler<any>;

    if (this.#isStreaming) {
      current = this.#stream;
    } else {
      const next = this.#queue.pop();
      if (next) {
        current = next;
      } else {
        current = this.#stream;
        this.#isStreaming = true;
      }
    }

    if (isBlob(event.data)) {
      (event.data as Blob).text().then(
        blob => current(JSON.parse(blob), ws, event)
      );
    } else {
      current(JSON.parse(event.data.toString()), ws, event);
    }
  }
}

/**
 * The Ocelloids client.
 */
export class OcelloidsClient {
  readonly #config: OcelloidsClientConfig;
  readonly #headers: {};

  constructor(config: OcelloidsClientConfig) {
    this.#config = config;

    const headers : Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    if (config.httpAuthToken) {
      headers['Authorization'] = `Bearer ${config.httpAuthToken}`;
    }

    this.#headers = headers;
  }

  async create(subscription: QuerySubscription) {
    return new Promise<void>(async (resolve, reject) => {
      const res = await fetch(this.#config.httpUrl + '/subs', {
        method: 'POST',
        headers: this.#headers,
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
      const res = await fetch(this.#config.httpUrl + '/subs/' + subscriptionId);
      if (res.ok) {
        resolve((await res.json()) as QuerySubscription);
      } else {
        reject(await res.json());
      }
    });
  }

  async health() {
    return new Promise(async (resolve, reject) => {
      const res = await fetch(this.#config.httpUrl + '/health');
      if (res.ok) {
        resolve(await res.json());
      } else {
        reject(await res.text());
      }
    });
  }

  async subscribe(
    subscription: string | OnDemandQuerySubscription,
    handlers: WebSocketHandlers
  ): Promise<WebSocket> {
    const url = this.#config.wsUrl + '/ws/subs';

    return typeof subscription === 'string'
      ? this.#openWebSocket(`${url}/${subscription}`, handlers)
      : this.#openWebSocket(url, handlers, subscription);
  }

  #openWebSocket(
    url: string,
    { onMessage, onError, onClose }: WebSocketHandlers,
    sub?: OnDemandQuerySubscription
  ) {
    return new Promise<WebSocket>((resolve, reject) => {
      const protocol = new Protocol(onMessage);
      const ws = new WebSocket(url);

      ws.onmessage = protocol.handle.bind(protocol);

      if (onError) {
        ws.onerror = onError;
      }

      if (onClose) {
        ws.onclose = onClose;
      }

      function requestOnDemandSub() {
        ws.send(JSON.stringify(sub));
        protocol.next<QuerySubscription>(msg => {
          // TODO add callback?
          // TODO handle failure...
          console.log('> subscription', msg);
        });
      }

      ws.onopen = () => {
        if (ws.readyState === 1) {
          if (this.#config.wsAuthToken) {
            ws.send(this.#config.wsAuthToken);
            protocol.next(() => {
              // note that will error if auth fails
              if (sub) {
                requestOnDemandSub();
              }
            });
          } else if (sub) {
            requestOnDemandSub();
          }

          resolve(ws);
        } else {
          reject('ws ready state: ' + ws.readyState);
        }
      };
    });
  }
}