import { FastifyInstance } from 'fastify';

import { jsonEncoded, prefixes } from '../types.js';

type keyParam = {
  Params: {
    key: string
  }
};

const itOps = {
  limit: 10_000
};

export default async function Administration(
  fastify: FastifyInstance
) {
  const { storage: { root }, scheduler } = fastify;

  const opts = {
    onRequest: [fastify.auth],
    schema: {
      hide: true
    }
  };

  const inDB = root.sublevel<string, any>(
    prefixes.matching.inbound, jsonEncoded
  );
  const outDB = root.sublevel<string, any>(
    prefixes.matching.inbound, jsonEncoded
  );
  const tipsDB = root.sublevel<string, any>(
    prefixes.cache.tips, jsonEncoded
  );

  fastify.get('/admin/cache/tips', opts, async (_, reply) => {
    reply.send(await tipsDB.iterator(itOps).all());
  });

  fastify.get<keyParam>('/admin/cache/:key', opts, async (request, reply) => {
    const db = root.sublevel<string, any>(
      prefixes.cache.family(request.params.key), jsonEncoded
    );
    reply.send(await db.iterator(itOps).all());
  });

  fastify.get('/admin/subs', opts, async (_, reply) => {
    const uniques = await root.sublevel<string, any>(
      prefixes.subs.uniques, jsonEncoded
    ).iterator(itOps).all();
    reply.send({
      uniques
    });
  });

  fastify.get('/admin/xcm', opts, async (_, reply) => {
    const outbound = await inDB.iterator(itOps).all();
    const inbound = await outDB.iterator(itOps).all();
    reply.send({
      outbound,
      inbound
    });
  });

  fastify.delete<keyParam>(
    '/admin/xcm/inbound/:key', opts, async (request, reply) => {
      await inDB.del(request.params.key);
      reply.send();
    }
  );

  fastify.delete<keyParam>(
    '/admin/xcm/outbound/:key', opts, async (request, reply) => {
      await outDB.del(request.params.key);
      reply.send();
    }
  );

  fastify.get('/admin/sched', opts , async (_, reply) => {
    reply.send(await scheduler.allTaskTimes());
  });

  fastify.get<keyParam>(
    '/admin/sched/:key', opts, async (request, reply) => {
      reply.send(
        await scheduler.getById(request.params.key)
      );
    }
  );

  fastify.delete<keyParam>(
    '/admin/sched/:key', opts, async (request, reply) => {
      await scheduler.remove(request.params.key);
      reply.send();
    }
  );
}