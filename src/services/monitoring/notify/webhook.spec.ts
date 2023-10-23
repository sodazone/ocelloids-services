import { buildMockServer } from '../../../_mocks/webhook.js';
import { webhookNotifyHandler } from './webhook.js';

it('should post a notification', async () => {
  const fastify = buildMockServer();
  await fastify.listen({
    port: 0
  });
  const { address, port } = fastify.server.address() as {
    address: string,
    port: number
  };

  const handler = webhookNotifyHandler();
  await handler({
    destinations: [],
    id: '',
    notify: {
      type: 'webhook',
      url: `http://${address}:${port}/`
    },
    origin: 0,
    senders: []
  }, {
    subscriptionId: '1',
    messageHash: '0xCAFE',
    destination: {
      blockHash: '0xBEEF',
      blockNumber: '2',
      chainId: 0,
      event: {}
    },
    origin: {
      blockHash: '0xBEEF',
      blockNumber: '2',
      chainId: 0,
      event: {}
    },
    outcome: 'Success',
    instructions: '0x',
    messageData: '0x',
    error: undefined
  });

  await fastify.close();
});