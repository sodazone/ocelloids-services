import { FastifyInstance, FastifyPluginOptions } from 'fastify';

import type { Header } from '@polkadot/types/interfaces';

import Connector from './connector.js';
import { XcmMessageEvent } from './types.js';
import { FinalizedCollector, OutboundMessageCollector} from './collectors/index.js';
import { QuerySubscription } from './subscriptions/types.js';

/**
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function monitoringService(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  const { engine, db, log, config } = fastify;

  const ctx = {
    log,
    config
  };

  const connector = new Connector(ctx);
  const outCollector = new OutboundMessageCollector(ctx, connector, db);

  outCollector.on('message', (message: XcmMessageEvent) => {
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

  outCollector.on('receive', (message: XcmMessageEvent) => {
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

  outCollector.start();

  const finCollector = new FinalizedCollector(connector);

  finCollector.on('head', ({
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

  finCollector.start();

  fastify.addHook('onClose', async () => {
    log.info('Shutting down monitoring service');

    outCollector.stop();
    await connector.disconnect();
  });

  fastify.get('/',{}, async (_request, reply) => {
    reply.send('Bob Dobbs');
  });

  fastify.get('/subs', {}, async (_request, reply) => {
    reply.status(201).send(outCollector.listSubscriptions());
  });

  fastify.post<{
    Body: QuerySubscription
  }>('/sub', {}, async (request, reply) => {
    outCollector.subscribe(request.body);

    reply.status(201).send();
  });

  fastify.post<{
    Body: { id: string }
  }>('/unsub', {}, async (request, reply) => {
    outCollector.unsubscribe(request.body.id);

    reply.status(201).send();
  });
}

export default monitoringService;