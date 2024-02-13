import { EventEmitter } from 'node:events';

import { z } from 'zod';
import { FastifyRequest } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { ulid } from 'ulidx';

import { Logger } from '../../../types.js';
import {
  $QuerySubscription,
  QuerySubscription,
  XcmEventListener,
  XcmNotifyMessage,
  isXcmMatched,
  isXcmSent
} from '../../types.js';
import { Switchboard } from '../../switchboard.js';
import { TelemetryEventEmitter, notifyTelemetryFrom } from '../../../telemetry/types.js';

const MAX_WS_CLIENTS = 1000;

const jsonSchema = z.string().transform( ( str, ctx ) => {
  try {
    return {
      ...JSON.parse( str ),
      id: ulid(),
      ephemeral: true,
      channels: [{
        type: 'websocket'
      }]
    };
  } catch ( e ) {
    ctx.addIssue( { code: 'custom', message: 'Invalid JSON' } );
    return z.NEVER;
  }
} ).pipe($QuerySubscription);

type Connection = {
  id: string,
  ip: string,
  stream: SocketStream
}

function safeWrite(stream: SocketStream, content: Object) {
  return stream.writable
    ? stream.write(JSON.stringify(content))
    : false;
}

/**
 * Websockets subscription protocol.
 */
export default class WebsocketProtocol extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #log: Logger;
  readonly #switchboard: Switchboard;
  readonly #broadcaster: XcmEventListener;

  #connections: Map<string, Connection[]>;
  #clientsNum: number;

  constructor(
    log: Logger,
    switchboard: Switchboard
  ) {
    super();

    this.#log = log;
    this.#switchboard = switchboard;

    this.#connections = new Map();
    this.#clientsNum = 0;
    this.#broadcaster = (sub, xcm) => {
      const connections = this.#connections.get(sub.id);
      if (connections) {
        for (const connection of connections) {
          const {stream, ip} = connection;
          try {
            safeWrite(stream, xcm);

            this.#telemetryNotify(ip, xcm)
          } catch (error) {
            this.#log.error(error);

            const errorMessage = error instanceof Error ? error.message : String(error);
            this.#telemetryNotifyError(ip, xcm, errorMessage);
          }
        }
      }
    };

    this.#switchboard.addNotificationListener('websocket', this.#broadcaster);
  }

  /**
   * Handles incoming connections.
   *
   * If no subscription is given creates an ephemeral through the websocket.
   *
   * @param stream The websocket stream
   * @param request The Fastify request
   * @param subscription The query subscription
   */
  async handle(
    stream: SocketStream,
    request: FastifyRequest,
    subscription?: QuerySubscription
  ) {
    if (this.#clientsNum >= MAX_WS_CLIENTS) {
      stream.socket.close(1013, 'server too busy');
      return;
    }

    let subId : string;

    if (subscription) {
      // existing subscriptions
      subId = subscription.id;
      if (this.#connections.has(subId)) {
        this.#log.warn('trying duplicated subscription %s', subId);
      } else {
        this.#addSubscriber(subscription, stream, request);
      }
    } else {
      // on-demand ephemeral subscriptions
      stream.on('data', (data: Buffer) => {
        setImmediate(async () => {
          if (subId) {
            safeWrite(stream, { id: subId });
          } else {
            const parsed = jsonSchema.safeParse(data.toString());
            if (parsed.success) {
              const onDemandSub = parsed.data;
              try {
                this.#addSubscriber(onDemandSub, stream, request);
                subId = onDemandSub.id;
                await this.#switchboard.subscribe(onDemandSub);
                safeWrite(stream, onDemandSub);
              } catch (error) {
                stream.socket.close(1013, 'server too busy');
                this.#log.error(error);
              }
            } else {
              safeWrite(stream, parsed.error);
            }
          }});
      });
    }
  }

  stop() {
    this.#switchboard.removeNotificationListener(
      'websocket', this.#broadcaster
    );
  }

  #addSubscriber(
    subscription: QuerySubscription,
    stream: SocketStream,
    request: FastifyRequest
  ) {
    this.#clientsNum++;

    const subId = subscription.id;
    const connection = {
      id: request.id, ip: request.ip, stream
    };

    if (this.#connections.has(subId)) {
      this.#connections.get(subId)?.push(connection);
    } else {
      this.#connections.set(subId, [connection]);
    }

    this.emit('telemetrySocketListener', request.ip, subscription);

    stream.socket.once('close', async () => {
      this.#clientsNum--;

      const { id, ephemeral } = subscription;

      try {
        if (ephemeral) {
          // TODO clean up pending matches
          await this.#switchboard.unsubscribe(id);
        }

        this.emit('telemetrySocketListener', request.ip, subscription, true);
      } catch (error) {
        this.#log.error(error);
      } finally {
        // TODO: check if frees memory
        const connections = this.#connections.get(id);
        if (connections) {
          const index = connections.findIndex(c => c.id === request.id);
          if (index > -1) {
            connections.splice(index, 1);
          }
          if (connections.length === 0) {
            this.#connections.delete(id);
          }
        }
      }
    }
    );
  }

  #telemetryNotify(
    ip: string,
    xcm: XcmNotifyMessage
  ) {
    if(isXcmMatched(xcm)) {
      this.emit('telemetryNotify', notifyTelemetryFrom(
        'websocket', ip, xcm
      ));
    } else {
      console.log(`XCM ${xcm.waypoint} telemetryNotify not implemented.`);
    }
  }

  #telemetryNotifyError(
    ip: string,
    xcm: XcmNotifyMessage,
    errorMessage: string
  ) {
    if(isXcmMatched(xcm)) {
      this.emit('telemetryNotifyError', notifyTelemetryFrom(
        'websocket', ip, xcm, errorMessage
      ));
    } else {
      console.log(`XCM ${xcm.waypoint} telemetryNotifyError not implemented.`);
    }
  }
}