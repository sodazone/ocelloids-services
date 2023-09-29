import { FastifyInstance, FastifyPluginOptions } from 'fastify';

import type { Header } from '@polkadot/types/interfaces';

import Connector from './connector.js';
import { XcmMessageEvent } from './types.js';
import { FinalizedCollector, OutboundMessageCollector} from './collectors/index.js';
import { DummyConfiguration } from './configuration.js';
import { QuerySubscription } from 'subscriptions/types.js';

/**
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function monitoring(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  const { log, engine, db } = fastify;

  log.info('Register monitoring service routes');

  const ctx = {
    log,
    config: DummyConfiguration,
  };

  const connector = new Connector(ctx);
  const outCollector = new OutboundMessageCollector(ctx, connector, db);

  outCollector.on('message', (message: XcmMessageEvent) => {
    console.log('outbound', message);
    engine.waitOrigin({
      chainId: message.chainId,
      blockHash: message.event.blockHash.toHex()
    }, {
      recipient: message.recipient,
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
    console.log('finalized', head.hash.toHex());
    engine.onFinalizedBlock({
      chainId, blockHash: head.hash.toHex()
    });
  });

  finCollector.start();

  fastify.addHook('onClose', async () => {
    outCollector.stop();
    await connector.disconnect();
  });

  fastify.get('/',{}, async (_request, reply) => {
    reply.send('Bob Dobbs');
  });

  fastify.post<{
    Body: QuerySubscription
  }>('/sub', {}, async (request, reply) => {
    outCollector.subscribe(request.body);

    reply.status(201).send();
  });
}

export default monitoring;