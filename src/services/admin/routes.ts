import { FastifyInstance } from 'fastify';

export default async function Administration(
  fastify: FastifyInstance
) {
  const { log, storage: { root }, scheduler } = fastify;

  fastify.delete(
    '/admin/storage/root',
    {
      onRequest: [fastify.auth]
    },
    async (request, reply) => {
      log.warn(
        'Clearing root database %s %j',
        request.ip,
        request.headers
      );
      await root.clear();
      reply.send();
    }
  );

  fastify.get('/admin/scheduled',{
    onRequest: [fastify.auth],
    schema: {
      hide: true,
      response: {
        200: {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      }
    }
  }, async (_, reply) => {
    reply.send(await scheduler.allTaskTimes());
  });

  fastify.get<{
    Params: {
      id: string
    }
  }>('/admin/scheduled/:id',{
    onRequest: [fastify.auth],
    schema: {
      hide: true
    }
  }, async (request, reply) => {
    reply.send(
      await scheduler.getById(request.params.id)
    );
  });

  fastify.delete<{
    Params: {
      id: string
    }
  }>('/admin/scheduled/:id',{
    onRequest: [fastify.auth],
    schema: {
      hide: true,
      response: {
        200: {
          type: 'null'
        }
      }
    }
  }, async (request, reply) => {
    await scheduler.remove(request.params.id);
    reply.send();
  });
}