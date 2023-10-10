import { FastifyInstance } from 'fastify';

import Connector from '../connector.js';
import { XcmMessageEvent } from './types.js';
import { MessageCollector, HeadCatcher, Inbound, Outbound } from './collectors/index.js';
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
  const { engine, db, log, config } = fastify;

  const ctx = {
    log,
    config
  };

  const connector = new Connector(ctx);
  const headCatcher = new HeadCatcher(ctx, connector, db);
  const msgCollector = new MessageCollector(ctx, connector, db, headCatcher);

  msgCollector.on(Outbound, (message: XcmMessageEvent) => {
    log.info(
      `out xcm: [chainId=${message.chainId}, messageHash=${message.messageHash}, recipient=${message.recipient}`
    );

    engine.onOutboundMessage({
      chainId: message.chainId,
      blockHash: message.event.blockHash.toHex(),
      blockNumber: message.event.blockNumber.toString()
    }, {
      recipient: message.recipient,
      messageHash: message.messageHash
    });
  });

  msgCollector.on(Inbound, (message: XcmMessageEvent) => {
    log.info(
      `in xcm: [chainId=${message.chainId}, messageHash=${message.messageHash}`
    );

    engine.onInboundMessage({
      chainId: message.chainId,
      blockHash: message.event.blockHash.toHex(),
      blockNumber: message.event.blockNumber.toString()
    }, {
      messageHash: message.messageHash
    });
  });

  await headCatcher.start();
  await msgCollector.start();

  fastify.addHook('onClose', async () => {
    log.info('Shutting down monitoring service');

    msgCollector.stop();
    headCatcher.stop();
    await connector.disconnect();
  });

  await fastify.register(SubscriptionApi, {
    msgCollector,
  });
}

export default Monitoring;