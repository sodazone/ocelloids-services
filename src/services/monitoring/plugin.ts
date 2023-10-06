import { FastifyInstance } from 'fastify';

import type { Header } from '@polkadot/types/interfaces';

import Connector from '../connector.js';
import { XcmMessageEvent } from './types.js';
import { FinalizedHeadCollector, MessageCollector } from './collectors/index.js';
import { SubscriptionApi } from './api.js';

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
  const msgCollector = new MessageCollector(ctx, connector, db);

  msgCollector.on('message', (message: XcmMessageEvent) => {
    log.info(
      `out xcm: [chainId=${message.chainId}, messageHash=${message.messageHash}, recipient=${message.recipient}`
    );

    engine.waitOrigin({
      chainId: message.chainId,
      blockHash: message.event.blockHash.toHex()
    }, {
      recipient: message.recipient,
      messageHash: message.messageHash
    });
  });

  msgCollector.on('receive', (message: XcmMessageEvent) => {
    log.info(
      `in xcm: [chainId=${message.chainId}, messageHash=${message.messageHash}`
    );

    engine.waitDestination({
      chainId: message.chainId,
      blockHash: message.event.blockHash.toHex()
    }, {
      messageHash: message.messageHash
    });
  });

  msgCollector.start();

  const finHeadCollector = new FinalizedHeadCollector(ctx, connector);

  finHeadCollector.on('head', ({
    chainId, head
  } : {
    chainId: string | number, head: Header
  }) => {
    log.info(
      `finalized: [chainId=${chainId}, hash=${head.hash.toHex()}, block=${head.number.toNumber()}]`
    );

    engine.onFinalizedBlock({
      chainId, blockHash: head.hash.toHex()
    });
  });

  finHeadCollector.start();

  fastify.addHook('onClose', async () => {
    log.info('Shutting down monitoring service');

    msgCollector.stop();
    finHeadCollector.stop();
    await connector.disconnect();
  });

  fastify.register(SubscriptionApi, {
    collector: msgCollector
  });
}

export default Monitoring;