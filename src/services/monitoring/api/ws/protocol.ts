import { EventEmitter } from 'node:events';

import { z } from 'zod';
import { FastifyRequest } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { ulid } from 'ulidx';

import { Logger } from '../../../types.js';
import { $QuerySubscription, QuerySubscription, XcmMatchedListener } from '../../types.js';
import { Switchboard } from '../../switchboard.js';
import { TelemetryEventEmitter, notifyTelemetryFrom } from '../../../telemetry/types.js';

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
  #log: Logger;
  #switchboard: Switchboard;
  #broadcaster: XcmMatchedListener;
  #connections: Map<string, Connection[]>;

  constructor(
    log: Logger,
    switchboard: Switchboard
  ) {
    super();

    this.#log = log;
    this.#switchboard = switchboard;

    this.#connections = new Map();
    this.#broadcaster = (sub, xcm) => {
      const connections = this.#connections.get(sub.id);
      if (connections) {
        for (const connection of connections) {
          const {stream, ip} = connection;
          try {
            safeWrite(stream, xcm);

            this.emit('telemetryNotify', notifyTelemetryFrom(
              'websocket', ip, xcm
            ));
          } catch (error) {
            this.#log.error(error);

            const errorMessage = error instanceof Error ? error.message : String(error);
            this.emit('telemetryNotifyError', notifyTelemetryFrom(
              'websocket', ip, xcm, errorMessage
            ));
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
      stream.on('data', async (data: Buffer) => {
        if (subId) {
          safeWrite(stream, { id: subId });
        } else {
          const parsed = jsonSchema.safeParse(data.toString());
          if (parsed.success) {
            const onDemandSub = parsed.data;
            try {
              await this.#switchboard.subscribe(onDemandSub);
              subId = onDemandSub.id;
              this.#addSubscriber(onDemandSub, stream, request);
              safeWrite(stream, onDemandSub);
            } catch (error) {
              this.#log.error(error);
            }
          } else {
            safeWrite(stream, parsed.error);
          }
        }
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
    const subId = subscription.id;
    const connection = {
      id: request.id, ip: request.ip, stream
    };

    if (this.#connections.has(subId)) {
      this.#connections.get(subId)?.push(connection);
    } else {
      this.#connections.set(subId, [connection]);
    }

    stream.socket.once('close', async () => {
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
}