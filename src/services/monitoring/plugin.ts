import { FastifyInstance } from 'fastify';

import Connector from '../connector.js';
import { XcmMessageReceivedEvent, XcmMessageSentEvent } from './types.js';
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

  switchboard.on(Outbound, (message: XcmMessageSentEvent) => {
    log.info(
      `out xcm: [chainId=${message.chainId}, messageHash=${message.messageHash}, recipient=${message.recipient}`
    );

    engine.onOutboundMessage(message, message);
  });

  switchboard.on(Inbound, (message: XcmMessageReceivedEvent) => {
    log.info(
      `in xcm: [chainId=${message.chainId}, messageHash=${message.messageHash}`
    );

    engine.onInboundMessage(message, message);
  });

  engine.on(Notification, switchboard.onNotification);

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