import { FastifyInstance } from 'fastify';

import Connector from '../connector.js';
import { XcmMessageReceived, XcmMessageSent } from './types.js';
import { HeadCatcher } from './head-catcher.js';
import { Switchboard, Inbound, Outbound } from  './switchboard.js';
import { Notification } from '../../services/matching/engine.js';
import { SubscriptionApi } from './api/index.js';

/**
 * Monitoring service Fastify plugin.
 *
 * Exposes the subscription HTTP API and interfaces with
 * the XCM collector events and the matching engine.
 *
 * @param {FastifyInstance} fastify The Fastify instance.
 */
async function Monitoring(
  fastify: FastifyInstance
) {
  const { engine, db, janitor, log, config } = fastify;

  const ctx = {
    log,
    config
  };

  const connector = new Connector(ctx);
  const headCatcher = new HeadCatcher(ctx, connector, db, janitor);
  const switchboard = new Switchboard(ctx, connector, db, headCatcher);

  switchboard.on(Outbound, (message: XcmMessageSent) => {
    log.info(
      '[%s] OUT MESSAGE block=%s, messageHash=%s, recipient=%s',
      message.chainId,
      message.blockNumber,
      message.messageHash,
      message.recipient
    );

    engine.onOutboundMessage(message);
  });

  switchboard.on(Inbound, (message: XcmMessageReceived) => {
    log.info(
      '[%s] IN MESSAGE block=%s, messageHash=%s, outcome=%s',
      message.chainId,
      message.blockNumber,
      message.messageHash,
      message.outcome
    );

    engine.onInboundMessage(message);
  });

  engine.on(Notification, switchboard.onNotification.bind(switchboard));

  await headCatcher.start();
  await switchboard.start();

  fastify.addHook('onClose', async () => {
    log.info('Shutting down monitoring service');

    switchboard.stop();
    headCatcher.stop();
    await connector.disconnect();
  });

  await fastify.register(SubscriptionApi, {
    switchboard,
  });
}

export default Monitoring;