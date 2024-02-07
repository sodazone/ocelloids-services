import { EventEmitter } from 'node:events';

import { z } from 'zod';
import { SocketStream } from '@fastify/websocket';
import { ulid } from 'ulidx';

import { Logger } from '../../../types.js';
import { $QuerySubscription, QuerySubscription, XcmMatched, XcmMatchedListener } from '../../types.js';
import { Switchboard } from '../../switchboard.js';
import { TelemetryEventEmitter, notifyTelemetryFrom } from '../../../telemetry/types.js';
import { FastifyRequest } from 'fastify';

const v1 = JSON.stringify({
  protocol: 'xcmon/subs',
  version: 1
});

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

type SubWithListener = {
  sub: QuerySubscription,
  listener: XcmMatchedListener
};

/**
 * Websockets subscription protocol.
 */
export default class WebsocketProtocol extends (EventEmitter as new () => TelemetryEventEmitter) {
  #log: Logger;
  #switchboard: Switchboard;
  #connections: WeakMap<SocketStream, SubWithListener>;

  constructor(
    log: Logger,
    switchboard: Switchboard
  ) {
    super();

    this.#log = log;
    this.#switchboard = switchboard;

    this.#connections = new WeakMap<SocketStream, SubWithListener>();
  }

  /**
   * Handles incoming connections.
   *
   * If no subscription is given creates an ephemeral through the websocket.
   *
   * @param connection The websocket connection
   * @param request The Fastify request
   * @param subscription The query subscription
   */
  async handle(
    connection: SocketStream,
    request: FastifyRequest,
    subscription?: QuerySubscription
  ) {
    connection.socket.once('close', async () => {
      if (this.#connections.has(connection)) {
        try {
          const { sub: { id, ephemeral }, listener } = this.#connections.get(connection)!;
          if (ephemeral) {
            await this.#switchboard.unsubscribe(id);
          }
          this.#switchboard.removeNotificationListener('websocket', listener);
        } catch (error) {
          this.#log.error(error);
        } finally {
          this.#connections.delete(connection);
        }
      }
    });

    // the listener writes the notified messages
    const createListener = (sub: QuerySubscription) => {
      this.emit('telemetrySocketListener', request.ip, sub);

      const listener = (target: QuerySubscription, xcm: XcmMatched) => {
        if (sub.id === target.id) {
          try {
            connection.write(JSON.stringify(xcm));

            this.emit('telemetryNotify', notifyTelemetryFrom(
              'websocket',
              request.ip,
              xcm
            ));
          } catch (error) {
            this.#log.error(error);

            const errorMessage = error instanceof Error ? error.message : String(error);
            this.emit('telemetryNotifyError', notifyTelemetryFrom(
              'websocket',
              request.ip,
              xcm,
              errorMessage
            ));
          }
        }
      };
      this.#switchboard.addNotificationListener('websocket', listener);
      this.#connections.set(connection, { sub, listener });
    };

    if (subscription) {
      // persistent subscriptions
      createListener(subscription);
    } else {
      // ephemeral subscriptions
      connection.on('data', async (data: Buffer) => {
        if (this.#connections.has(connection)) {
          connection.write(
            JSON.stringify({ id: this.#connections.get(connection)?.sub.id })
          );
        } else {
          const parsed = jsonSchema.safeParse(data.toString());
          if (parsed.success) {
            const sub = parsed.data;
            try {
              await this.#switchboard.subscribe(sub);
              createListener(sub);
              connection.write(JSON.stringify(sub));
            } catch (error) {
              this.#log.error(error);
            }
          } else {
            connection.write(JSON.stringify(parsed.error));
          }
        }
      });
    }

    connection.write(v1);
  }
}