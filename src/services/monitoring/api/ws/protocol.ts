import { z } from 'zod';
import { SocketStream } from '@fastify/websocket';
import { ulid } from 'ulidx';

import { Logger } from '../../../types.js';
import { $QuerySubscription, QuerySubscription, XcmMatched, XcmMatchedListener } from '../../types.js';
import { Switchboard } from '../../switchboard.js';

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
const connections = new WeakMap<SocketStream, SubWithListener>();

/**
 * Websockets subscription protocol.
 *
 * @param log The logger instance
 * @param switchboard The switchboard
 * @param connection The socket stream
 */
// TODO: websockets telemetry
export async function wsSubscriptionHandler(
  log: Logger,
  switchboard: Switchboard,
  connection: SocketStream,
  subscription?: QuerySubscription
) {
  connection.socket.once('close', async () => {
    if (connections.has(connection)) {
      try {
        const { sub: { id, ephemeral }, listener } = connections.get(connection)!;
        if (ephemeral) {
          await switchboard.unsubscribe(id);
        }
        switchboard.removeNotificationListener('websocket', listener);
      } catch (error) {
        log.error(error);
      } finally {
        connections.delete(connection);
      }
    }
  });

  // the listener writes the notified messages
  const createListener = (sub: QuerySubscription) => {
    const listener = (target: QuerySubscription, xcm: XcmMatched) => {
      if (sub.id === target.id) {
        connection.write(JSON.stringify(xcm));
      }
    };
    switchboard.addNotificationListener('websocket', listener);
    connections.set(connection, { sub, listener });
  };

  if (subscription) {
    // persistent subscriptions
    createListener(subscription);
  } else {
    // ephemeral subscriptions
    connection.on('data', async (data: Buffer) => {
      if (connections.has(connection)) {
        connection.write(
          JSON.stringify({ id: connections.get(connection)?.sub.id })
        );
      } else {
        const parsed = jsonSchema.safeParse(data.toString());
        if (parsed.success) {
          const sub = parsed.data;
          try {
            await switchboard.subscribe(sub);
            createListener(sub);
            connection.write(JSON.stringify(sub));
          } catch (error) {
            log.error(error);
          }
        } else {
          connection.write(JSON.stringify(parsed.error));
        }
      }
    });
  }

  connection.write(v1);
}